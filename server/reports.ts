import type { DailyReportPreview, Locale, ProjectConfig, ProjectStatus } from '../shared/types.js'
import { nextCopy, workflowCopy } from '../shared/copy.js'
import type { SecretProvider } from './security.js'

export function localDateKey(now: Date, timezone: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map((part) => [part.type, part.value]))
  return `${p.year}-${p.month}-${p.day}`
}

export function generateDailyReport(project: ProjectConfig, status: ProjectStatus, locale: Locale, now = new Date()): DailyReportPreview {
  const t = workflowCopy[locale]
  const timezone = project.dailyReport.timezone
  const today = localDateKey(now, timezone)
  const yesterday = new Date(today + 'T12:00:00Z')
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: timezone }).format(now)
  const count = (value: number | null) => value === null ? t.unknown : new Intl.NumberFormat(locale).format(value)
  const doing = status.github.state === 'connected' ? status.github.issues.filter((i) => i.state !== 'CLOSED' && i.labels.includes('status:doing')).length : null
  const history = (status.github.history ?? []).filter((row) => localDateKey(new Date(row.completedAt), timezone) === yesterdayKey)
  const lines = [
    `# ${project.displayName} ${t.report}`, '', `> ${date} · ${t.generated}`, '',
    `## ${t.completed}`, '',
    ...(status.github.state !== 'connected' || !status.github.history ? [`- ${t.historyUnavailable}`] : history.length
      ? history.map((row) => `- ${row.kind === 'pr' ? 'PR' : 'Issue'} [#${row.number} ${row.title}](${row.url})`) : [`- ${t.noHistory}`]),
    '', `## ${t.queues}`, '',
    ...Object.entries({ todo: status.metrics.todo, doing, review: status.metrics.review, rework: status.metrics.rework, testing: status.metrics.testing }).map(([key, value]) => `- ${t[key]}: ${count(value)}`),
    '', `## ${t.human}`, '',
    ...(status.github.state !== 'connected' ? [`- ${t.unknownReason}`] : status.actions.length ? status.actions.flatMap((action) => [
      `- ${t[action.kind]}: ${count(action.count)}`,
      ...(action.items ?? []).map((item) => `  - ${item.url ? `[${item.title}](${item.url})` : item.title}${item.blockedBy?.length ? ` · ${t.blocked}: ${item.blockedBy.map((id) => `#${id}`).join(', ')}` : ''}`)
    ]) : [`- ${t.none}`]),
    '', `## ${t.blockers}`, '',
    `- ${nextCopy[locale][status.factory.nextCode ?? 'unavailable'] ?? nextCopy[locale].unavailable}`,
    ...(status.github.candidate?.state === 'unavailable' ? [`- ${t.unknownReason}`] : []),
  ]
  return { projectId: project.id, generatedAt: now.toISOString(), locale, markdown: lines.join('\n'), sent: false,
    notificationConfigured: project.notification.type === 'webhook' && Boolean(project.notification.target) }
}

export async function sendDailyReport(
  preview: DailyReportPreview,
  project: ProjectConfig,
  secrets: SecretProvider,
): Promise<DailyReportPreview> {
  if (project.notification.type !== 'webhook' || !project.notification.target) throw new Error('notification_not_configured')
  const target = secrets.resolve(project.notification.target)
  if (!target) throw new Error('notification_secret_not_configured')
  const url = new URL(target)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('notification_url_invalid')
  if (url.username || url.password) throw new Error('notification_url_invalid')
  const secret = secrets.resolve(project.notification.webhookSecretRef)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
    body: JSON.stringify({ text: preview.markdown }),
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error(`notification_failed_${response.status}`)
  return { ...preview, sent: true }
}
