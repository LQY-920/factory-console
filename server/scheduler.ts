import type { Store } from './db.js'
import { generateDailyReport, sendDailyReport } from './reports.js'
import { redactSecrets, type SecretProvider } from './security.js'
import { getProjectStatus } from './status.js'

function localParts(now: Date, timezone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
}

export function startDailyReportScheduler(store: Store, secrets: SecretProvider, intervalMs = 30_000): () => void {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const now = new Date()
      for (const project of store.listProjects().filter((item) => item.enabled && item.dailyReport.enabled)) {
        let parts: Record<string, string>
        try { parts = localParts(now, project.dailyReport.timezone) } catch { continue }
        if (`${parts.hour}:${parts.minute}` !== project.dailyReport.time) continue
        const localDate = `${parts.year}-${parts.month}-${parts.day}`
        const alreadyGenerated = store.listRuns(project.id).some((run) => run.action === 'dailyReportGenerate' && localParts(new Date(run.startedAt), project.dailyReport.timezone).year === parts.year && localParts(new Date(run.startedAt), project.dailyReport.timezone).month === parts.month && localParts(new Date(run.startedAt), project.dailyReport.timezone).day === parts.day)
        if (alreadyGenerated) continue
        const run = store.createRun(project.id, 'dailyReportGenerate', `schedule ${project.dailyReport.time} ${project.dailyReport.timezone}`)
        try {
          const status = await getProjectStatus(project, secrets)
          let preview = generateDailyReport(project, status, 'zh-CN')
          if (preview.notificationConfigured) preview = await sendDailyReport(preview, project, secrets)
          store.finishRun(run.id, 0, `${localDate}\n${preview.markdown}`)
        } catch (error) {
          store.finishRun(run.id, 1, redactSecrets(error instanceof Error ? error.message : 'scheduled_report_failed'))
        }
      }
    } finally { running = false }
  }
  const timer = setInterval(() => { void tick() }, intervalMs)
  timer.unref()
  void tick()
  return () => clearInterval(timer)
}

