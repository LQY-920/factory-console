import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ActionId, ApiError, ProjectConfig, ProjectInput } from '../shared/types.js'
import { buildActionCommand, ACTION_ALLOWLIST, runCommand } from './commands.js'
import { createStore, type Store } from './db.js'
import { generateDailyReport, sendDailyReport } from './reports.js'
import { projectInputSchema, reportRequestSchema } from './schema.js'
import { EnvironmentSecretProvider, redactSecrets, type SecretProvider } from './security.js'
import { getProjectStatus, validateProject } from './status.js'

export interface AppDependencies {
  store?: Store
  secrets?: SecretProvider
}

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { handler(req, res).catch(next) }

export function createApp(dependencies: AppDependencies = {}) {
  const app = express()
  const store = dependencies.store ?? createStore()
  const secrets = dependencies.secrets ?? new EnvironmentSecretProvider()
  const statusCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof getProjectStatus>> }>()
  const statusInFlight = new Map<string, Promise<Awaited<ReturnType<typeof getProjectStatus>>>>()
  const readStatus = (project: ProjectConfig) => {
    const cached = statusCache.get(project.id)
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)
    const existing = statusInFlight.get(project.id)
    if (existing) return existing
    const request = getProjectStatus(project, secrets).then((value) => {
      statusCache.set(project.id, { expiresAt: Date.now() + 10_000, value })
      return value
    }).finally(() => statusInFlight.delete(project.id))
    statusInFlight.set(project.id, request)
    return request
  }
  app.disable('x-powered-by')
  app.use(express.json({ limit: '256kb' }))

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))

  app.get('/api/projects', (_req, res) => res.json(store.listProjects()))

  app.post('/api/projects', (req, res) => {
    const parsed = projectInputSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_project', errorKey: 'errors.invalidProject', details: parsed.error.flatten() })
    res.status(201).json(store.createProject(parsed.data as ProjectInput))
  })

  app.put('/api/projects/:id', (req, res) => {
    const parsed = projectInputSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_project', errorKey: 'errors.invalidProject', details: parsed.error.flatten() })
    const project = store.updateProject(String(req.params.id), parsed.data as ProjectInput)
    if (!project) return res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' })
    res.json(project)
  })

  app.delete('/api/projects/:id', (req, res) => {
    if (!store.deleteProject(String(req.params.id))) return res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' })
    res.status(204).end()
  })

  app.post('/api/projects/:id/validate', asyncRoute(async (req, res) => {
    const project = store.getProject(String(req.params.id))
    if (!project) { res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' }); return }
    res.json(await validateProject(project, secrets))
  }))

  app.get('/api/projects/:id/status', asyncRoute(async (req, res) => {
    const project = store.getProject(String(req.params.id))
    if (!project) { res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' }); return }
    res.json(await readStatus(project))
  }))

  app.get('/api/projects/:id/actions', (req, res) => {
    const project = store.getProject(String(req.params.id))
    if (!project) return res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' })
    res.json(Object.entries(ACTION_ALLOWLIST).map(([id, value]) => ({ id, ...value })))
  })

  app.post('/api/projects/:id/actions/:action', asyncRoute(async (req, res) => {
    const project = store.getProject(String(req.params.id))
    if (!project) { res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' }); return }
    const action = String(req.params.action) as ActionId
    if (!(action in ACTION_ALLOWLIST)) { res.status(400).json({ error: 'action_not_allowed', errorKey: 'errors.actionNotAllowed' }); return }
    if (ACTION_ALLOWLIST[action].mutating && req.body?.confirmed !== true) {
      res.status(409).json({ error: 'confirmation_required', errorKey: 'errors.confirmationRequired' }); return
    }
    const command = buildActionCommand(project, action)
    const run = store.createRun(project.id, action, command.display)
    const refs = [project.mysql.passwordSecretRef, project.deploy.credentialSecretRef, project.notification.webhookSecretRef]
    const result = await runCommand(command, secrets, refs, 60_000)
    const output = redactSecrets([result.stdout, result.stderr, result.timedOut ? '\n[TIMEOUT]' : ''].filter(Boolean).join('\n'))
    const finished = store.finishRun(run.id, result.exitCode, output)
    res.status(result.exitCode === 0 ? 200 : 422).json(finished)
  }))

  app.get('/api/projects/:id/runs', (req, res) => {
    const project = store.getProject(String(req.params.id))
    if (!project) return res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' })
    res.json(store.listRuns(project.id, typeof req.query.status === 'string' ? req.query.status : undefined))
  })

  app.get('/api/runs', (req, res) => {
    res.json(store.listRuns(
      typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
      typeof req.query.status === 'string' ? req.query.status : undefined,
    ))
  })

  app.post('/api/reports/daily/preview', asyncRoute(async (req, res) => {
    const parsed = reportRequestSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'invalid_report_request', errorKey: 'errors.invalidReportRequest' }); return }
    const project = store.getProject(parsed.data.projectId)
    if (!project) { res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' }); return }
    const status = await readStatus(project)
    res.json(generateDailyReport(project, status, parsed.data.locale))
  }))

  app.post('/api/reports/daily/send', asyncRoute(async (req, res) => {
    const parsed = reportRequestSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'invalid_report_request', errorKey: 'errors.invalidReportRequest' }); return }
    const project = store.getProject(parsed.data.projectId)
    if (!project) { res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' }); return }
    const status = await readStatus(project)
    const preview = generateDailyReport(project, status, parsed.data.locale)
    const run = store.createRun(project.id, 'dailyReportSend', 'webhook daily-report')
    try {
      const sent = await sendDailyReport(preview, project, secrets)
      store.finishRun(run.id, 0, 'Daily report delivered through configured webhook.')
      res.json(sent)
    } catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : 'notification_failed')
      store.finishRun(run.id, 1, message)
      res.status(422).json({ error: message, errorKey: 'errors.notificationFailed' })
    }
  }))

  const clientDir = resolve('dist', 'client')
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir))
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => res.sendFile(resolve(clientDir, 'index.html')))
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = redactSecrets(error instanceof Error ? error.message : 'internal_error')
    const body: ApiError = { error: message, errorKey: 'errors.internal' }
    res.status(500).json(body)
  })

  return { app, store }
}
