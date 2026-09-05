import type { Store } from './db.js'
import { generateDailyReport, localDateKey, sendDailyReport } from './reports.js'
import { projectSecretValues, redactSecrets, type SecretProvider } from './security.js'
import { getProjectStatus } from './status.js'

export async function runDueReports(store: Store, secrets: SecretProvider, now = new Date(), readStatus = getProjectStatus, deliver = sendDailyReport): Promise<void> {
  for (const project of store.listProjects().filter((p) => p.enabled && p.dailyReport.enabled)) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: project.dailyReport.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]))
    if (`${parts.hour}:${parts.minute}` < project.dailyReport.time) continue
    const day = localDateKey(now, project.dailyReport.timezone)
    if (store.hasScheduledReport(project.id, day)) continue
    const run = store.createRun(project.id, 'dailyReportGenerate', `schedule ${project.dailyReport.time} ${project.dailyReport.timezone}`)
    try {
      const status = await readStatus(project, secrets)
      let preview = generateDailyReport(project, status, project.dailyReport.locale ?? 'zh-CN', now)
      preview.markdown = redactSecrets(preview.markdown, projectSecretValues(project, secrets))
      preview = store.saveReport(preview, day) // Persist before delivery; unique per project/local date.
      store.finishRun(run.id, 0, preview.markdown)
      if (project.notification.type === 'webhook' && secrets.isConfigured(project.notification.target)) {
        const deliveryRun = store.createRun(project.id, 'dailyReportSend', 'webhook daily-report')
        try {
          await deliver(preview, project, secrets)
          store.setReportDelivery(preview.id!, true)
          store.finishRun(deliveryRun.id, 0, 'report_delivered')
        } catch {
          store.setReportDelivery(preview.id!, false, 'notification_failed')
          store.finishRun(deliveryRun.id, 1, 'notification_failed')
        }
      }
    } catch {
      store.finishRun(run.id, 1, 'scheduled_report_failed')
    }
  }
}

export function startDailyReportScheduler(store: Store, secrets: SecretProvider, intervalMs = 30_000): () => void {
  let running = false
  const tick = async () => { if (running) return; running = true; try { await runDueReports(store, secrets) } finally { running = false } }
  const timer = setInterval(() => { void tick().catch(() => undefined) }, intervalMs)
  timer.unref()
  void tick().catch(() => undefined)
  return () => clearInterval(timer)
}
