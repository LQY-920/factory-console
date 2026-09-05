import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ActionId, ApiError, ProjectConfig, ProjectInput } from '../shared/types.js'
import { buildActionCommand, ACTION_ALLOWLIST, isAllowedAction, runCommand } from './commands.js'
import { createStore, type Store } from './db.js'
import { generateDailyReport, sendDailyReport } from './reports.js'
import { projectInputSchema, reportRequestSchema } from './schema.js'
import { EnvironmentSecretProvider, projectSecretRefs, projectSecretValues, redactSecrets, type SecretProvider } from './security.js'
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
  const activeActions = new Set<string>()
  const redact = (text: string) => redactSecrets(text, store.listProjects().flatMap((project) => projectSecretValues(project, secrets)))
  const statusInFlight = new Map<string, Promise<Awaited<ReturnType<typeof getProjectStatus>>>>()
  const readStatus = (project: ProjectConfig) => {
    const key = JSON.stringify(project)
    const existing = statusInFlight.get(key)
    if (existing) return existing
    const request = getProjectStatus(project, secrets).finally(() => statusInFlight.delete(key))
    statusInFlight.set(key, request)
    return request
  }
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    const host = req.hostname
    if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host)) return res.status(403).json({ errorKey: 'errors.localOnly' })
    if (req.headers.origin && req.headers.origin !== `${req.protocol}://${req.headers.host}`) return res.status(403).json({ errorKey: 'errors.localOnly' })
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ errorKey: 'errors.invalidProject' })
    next()
  })
  app.use(express.json({ limit: '256kb' }))

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))

  app.get('/api/projects', (_req, res) => res.json(store.listProjects()))

  app.post('/api/projects', (req, res) => {
    const parsed = projectInputSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_project', errorKey: 'errors.invalidProject', details: parsed.error.flatten() })
    const project = store.createProject(parsed.data as ProjectInput)
    store.audit(project.id, 'projectCreate')
    res.status(201).json(project)
  })

  app.put('/api/projects/:id', (req, res) => {
    const parsed = projectInputSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_project', errorKey: 'errors.invalidProject', details: parsed.error.flatten() })
    const project = store.updateProject(String(req.params.id), parsed.data as ProjectInput)
    if (!project) return res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' })
    store.audit(project.id, 'projectUpdate')
    res.json(project)
  })

  app.delete('/api/projects/:id', (req, res) => {
    if (activeActions.has(String(req.params.id))) return res.status(409).json({ errorKey: 'errors.projectBusy' })
    if (!store.deleteProject(String(req.params.id))) return res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' })
    store.audit(String(req.params.id), 'projectDelete')
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
    if (!isAllowedAction(action)) { res.status(400).json({ error: 'action_not_allowed', errorKey: 'errors.actionNotAllowed' }); return }
    if (ACTION_ALLOWLIST[action].mutating && req.body?.confirmed !== true) {
      res.status(409).json({ error: 'confirmation_required', errorKey: 'errors.confirmationRequired' }); return
    }
    if (!project.enabled || activeActions.has(project.id)) { res.status(409).json({ errorKey: 'errors.projectBusy' }); return }
    const command = buildActionCommand(project, action)
    activeActions.add(project.id)
    try {
    const run = store.createRun(project.id, action, command.display)
    const refs = projectSecretRefs(project)
    const result = await runCommand(command, secrets, refs, ACTION_ALLOWLIST[action].mutating ? 180_000 : 60_000)
    const output = redactSecrets([result.stdout, result.stderr, result.timedOut ? '\n[TIMEOUT]' : ''].filter(Boolean).join('\n'))
    const finished = store.finishRun(run.id, result.exitCode, output)
    res.status(result.exitCode === 0 ? 200 : 422).json(finished)
    } finally { activeActions.delete(project.id); statusInFlight.clear() }
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
    const preview = generateDailyReport(project, status, parsed.data.locale)
    preview.markdown = redact(preview.markdown)
    preview.notificationConfigured = secrets.isConfigured(project.notification.target) && project.notification.type === 'webhook'
    store.audit(project.id, 'dailyReportPreview', redact(preview.markdown))
    res.json(store.saveReport(preview))
  }))

  app.get('/api/projects/:id/reports', (req, res) => {
    const project = store.getProject(String(req.params.id))
    if (!project) return res.status(404).json({ errorKey: 'errors.projectNotFound' })
    res.json(store.listReports(project.id))
  })

  app.post('/api/reports/daily/send', asyncRoute(async (req, res) => {
    const parsed = reportRequestSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'invalid_report_request', errorKey: 'errors.invalidReportRequest' }); return }
    const project = store.getProject(parsed.data.projectId)
    if (!project) { res.status(404).json({ error: 'project_not_found', errorKey: 'errors.projectNotFound' }); return }
    const status = await readStatus(project)
    const generated = generateDailyReport(project, status, parsed.data.locale)
    generated.markdown = redact(generated.markdown)
    const preview = store.saveReport(generated)
    const run = store.createRun(project.id, 'dailyReportSend', 'webhook daily-report')
    try {
      const sent = await sendDailyReport(preview, project, secrets)
      store.setReportDelivery(preview.id!, true)
      store.finishRun(run.id, 0, 'report_delivered')
      res.json(sent)
    } catch (error) {
      const message = redact(error instanceof Error ? error.message : 'notification_failed')
      store.setReportDelivery(preview.id!, false, 'notification_failed')
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
    const message = redact(error instanceof Error ? error.message : 'internal_error')
    const body: ApiError = { error: message, errorKey: 'errors.internal' }
    res.status(500).json(body)
  })

  return { app, store }
}
