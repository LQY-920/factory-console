import { Download, FileText, Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DailyReportPreview, Locale, ProjectConfig, ProjectInput } from '../../shared/types'
import { api } from '../api'
import { Badge, Button, Field, Panel } from '../components/ui'

export function ReportsPage({ project, onSave }: { project: ProjectConfig; onSave(input: ProjectInput, id: string): Promise<void> }) {
  const { t, i18n } = useTranslation()
  const [preview, setPreview] = useState<DailyReportPreview>()
  const [loading, setLoading] = useState<'preview' | 'send' | ''>('')
  const [schedule, setSchedule] = useState(project.dailyReport)
  const locale = (i18n.language === 'en-US' ? 'en-US' : 'zh-CN') as Locale
  const generate = async () => { setLoading('preview'); try { setPreview(await api.previewReport(project.id, locale)) } finally { setLoading('') } }
  const send = async () => { setLoading('send'); try { setPreview(await api.sendReport(project.id, locale)) } finally { setLoading('') } }
  const download = () => {
    if (!preview) return
    const url = URL.createObjectURL(new Blob([preview.markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${project.displayName}-daily-brief.md`; anchor.click(); URL.revokeObjectURL(url)
  }
  const saveSchedule = async () => {
    const { id: _id, createdAt: _created, updatedAt: _updated, ...input } = project
    await onSave({ ...input, dailyReport: schedule }, project.id)
  }
  return <div className="page-stack">
    <div className="page-heading"><div><h1>{t('reports.title')}</h1><p>{t('reports.subtitle')}</p></div><div className="heading-actions"><Button onClick={() => void generate()} loading={loading === 'preview'}><FileText size={17} />{t(loading === 'preview' ? 'reports.generating' : 'reports.preview')}</Button><Button onClick={download} disabled={!preview}><Download size={17} />{t('reports.download')}</Button><Button variant="primary" onClick={() => void send()} loading={loading === 'send'} disabled={!preview?.notificationConfigured}><Send size={17} />{t(loading === 'send' ? 'reports.sending' : 'reports.send')}</Button></div></div>
    <Panel title={t('schedule.title')}><div className="schedule-form"><label className="checkbox-field"><input type="checkbox" checked={schedule.enabled} onChange={(event) => setSchedule({ ...schedule, enabled: event.target.checked })} />{t(schedule.enabled ? 'schedule.enabled' : 'schedule.disabled')}</label><Field label={t('projects.time')}><input type="time" value={schedule.time} onChange={(event) => setSchedule({ ...schedule, time: event.target.value })} /></Field><Field label={t('projects.timezone')}><input value={schedule.timezone} onChange={(event) => setSchedule({ ...schedule, timezone: event.target.value })} /></Field><Button onClick={() => void saveSchedule()}>{t('common.save')}</Button></div></Panel>
    <Panel title={t('reports.preview')}>{preview ? <><div className="report-meta"><Badge tone={preview.sent ? 'success' : preview.notificationConfigured ? 'info' : 'neutral'}>{preview.sent ? t('reports.sent') : preview.notificationConfigured ? t('connection.configured') : t('reports.localOnly')}</Badge><time>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(preview.generatedAt))}</time></div><pre className="report-preview">{preview.markdown}</pre></> : <div className="report-empty"><FileText size={30} /><p>{t('reports.empty')}</p></div>}</Panel>
  </div>
}

