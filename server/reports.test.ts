// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { generateDailyReport } from './reports.js'
import { runDueReports } from './scheduler.js'
import { createStore } from './db.js'
import { EnvironmentSecretProvider } from './security.js'
import type { ProjectConfig, ProjectStatus } from '../shared/types.js'

const project = { id: 'test', displayName: 'Example', enabled: true, dailyReport: { enabled: true, time: '09:00', timezone: 'America/New_York', locale: 'en-US' }, notification: { type: 'none', target: '' }, mysql: {}, deploy: {} } as ProjectConfig
const status: ProjectStatus = { projectId: 'test', refreshedAt: '', git: {state: 'connected'}, pipeline: [], demo: false, secrets: {mysqlConfigured: false, deployConfigured: false, webhookConfigured: false}, metrics: { todo: 1, review: 0, rework: 0, testing: 0 }, actions: [], factory: { state: 'connected', fields: {}, sections: {}, nextCode: 'coding', summary: '旧的中文文本' }, github: {state: 'connected', issues: [], pullRequests: [], history: [
  {kind: 'issue', number: 1, title: 'Completed', url: 'https://example.test/1', completedAt: '2026-03-08T18:00:00Z'},
  {kind: 'pr', number: 2, title: 'Today', url: 'https://example.test/2', completedAt: '2026-03-09T12:00:00Z'},
] } }

describe('daily reports and reliable scheduling', () => {
  it('uses the project-local yesterday across DST and translates generated copy', () => {
    const report = generateDailyReport(project, status, 'en-US', new Date('2026-03-09T13:00:00Z'))
    expect(report.markdown).toContain('#1 Completed')
    expect(report.markdown).not.toContain('#2 Today')
    expect(report.markdown).not.toMatch(/[\u4e00-\u9fff]/)
  })
  it('generates only once per local day, catches up after 09:00 and keeps reports after delivery failure', async () => {
    const store = createStore(':memory:')
    const p = store.createProject({ ...project, notification: { type: 'webhook', target: 'SYNTHETIC_WEBHOOK_URL' } })
    const secrets = { isConfigured: () => true, resolve: () => 'https://example.invalid/SYNTHETIC' }
    const read = vi.fn().mockResolvedValue(status)
    const deliver = vi.fn().mockRejectedValue(new Error('network failure'))
    try {
      await runDueReports(store, secrets, new Date('2026-03-09T12:59:00Z'), read, deliver)
      expect(read).not.toHaveBeenCalled()
      await runDueReports(store, secrets, new Date('2026-03-09T14:15:00Z'), read, deliver)
      await runDueReports(store, secrets, new Date('2026-03-09T16:00:00Z'), read, deliver)
      expect(read).toHaveBeenCalledTimes(1)
      expect(deliver).toHaveBeenCalledTimes(1)
      expect(store.listReports(p.id)).toMatchObject([{ locale: 'en-US', deliveryError: 'notification_failed', sent: false }])
      expect(store.listReports(p.id)[0].markdown).toContain('Development Brief')
      expect(store.listRuns(p.id).some((r) => r.action === 'dailyReportSend' && r.status === 'failed')).toBe(true)
    } finally { store.close() }
  })
  it('does not send when notification variables are missing', async () => {
    const store = createStore(':memory:'); store.createProject(project)
    const deliver = vi.fn()
    try { await runDueReports(store, new EnvironmentSecretProvider(), new Date('2026-03-09T14:00:00Z'), async () => status, deliver); expect(deliver).not.toHaveBeenCalled() } finally { store.close() }
  })
})
