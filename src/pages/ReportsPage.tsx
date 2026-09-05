import { Download, FileText, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DailyReportPreview, Locale, ProjectConfig, ProjectInput } from '../../shared/types'
import { api } from '../api'
import { Badge, Button, Field, Panel } from '../components/ui'

export function ReportsPage({ project, onSave }: { project: ProjectConfig; onSave(input: ProjectInput, id: string): Promise<void> }) {
  const { t, i18n } = useTranslation()
  const [preview, setPreview] = useState<DailyReportPreview>()
  const [history, setHistory] = useState<DailyReportPreview[]>([])
  const [loading, setLoading] = useState<'preview' | 'send' | 'save' | ''>('')
  const [schedule, setSchedule] = useState(project.dailyReport)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const version = useRef(0)
  const locale: Locale = i18n.language === 'en-US' ? 'en-US' : 'zh-CN'
  const lastLocale = useRef(locale)
  const hasPreview = Boolean(preview)
  useEffect(() => {
    let cancelled = false
    version.current++
    setSchedule(project.dailyReport)
    void api.listReports(project.id).then((rows) => { if (!cancelled) setHistory(Array.isArray(rows) ? rows : []) }).catch(() => { if (!cancelled) setError('errors.loadRuns') })
    return () => { cancelled = true }
  }, [project.id, project.dailyReport])
  useEffect(() => {
    if (lastLocale.current === locale) return
    lastLocale.current = locale
    if (!hasPreview) return
    const current = ++version.current
    let cancelled = false
    setLoading('preview')
    void api.previewReport(project.id, locale).then((value) => { if (!cancelled && current === version.current) setPreview({ ...value, locale }) }).catch(() => { if (!cancelled && current === version.current) setError('errors.invalidReportRequest') }).finally(() => { if (!cancelled && current === version.current) setLoading('') })
    return () => { cancelled = true }
  }, [locale, project.id, hasPreview])
  const generate = async (send = false) => {
    const current = ++version.current
    setLoading(send ? 'send' : 'preview'); setError('')
    try {
      const value = send ? await api.sendReport(project.id, locale) : await api.previewReport(project.id, locale)
      if (current === version.current) {
        setPreview({ ...value, locale })
        const rows = await api.listReports(project.id)
        if (current === version.current) setHistory(Array.isArray(rows) ? rows : [])
      }
    } catch {
      if (current === version.current) {
        setError(send ? 'workflow.deliveryFailed' : 'errors.invalidReportRequest')
        void api.listReports(project.id).then((rows) => { if (current === version.current) setHistory(Array.isArray(rows) ? rows : []) }).catch(() => undefined)
      }
    } finally { if (current === version.current) setLoading('') }
  }
  const download = () => {
    if (!preview) return
    const url = URL.createObjectURL(new Blob([preview.markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${project.displayName}-daily-brief-${locale}.md`; anchor.click(); URL.revokeObjectURL(url)
  }
  const saveSchedule = async () => {
    const { id: _id, createdAt: _created, updatedAt: _updated, ...input } = project
    setLoading('save'); setError(''); setSaved(false)
    try { await onSave({ ...input, dailyReport: schedule }, project.id); setSaved(true) }
    catch { setError('workflow.saveFailed') } finally { setLoading('') }
  }
  return <div className="page-stack">
    <div className="page-heading"><div><h1>{t('reports.title')}</h1><p>{t('reports.subtitle')}</p></div><div className="heading-actions">
      <Button onClick={() => void generate()} loading={loading === 'preview'} disabled={Boolean(loading)}><FileText size={17} />{t('reports.preview')}</Button>
      <Button onClick={download} disabled={!preview || Boolean(loading)}><Download size={17} />{t('reports.download')}</Button>
      <Button variant="primary" onClick={() => void generate(true)} loading={loading === 'send'} disabled={!preview?.notificationConfigured || Boolean(loading)}><Send size={17} />{t('reports.send')}</Button>
    </div></div>
    {error ? <p role="alert" className="form-error">{t(error)}</p> : null}
    {saved ? <p role="status">{t('workflow.saved')}</p> : null}
    <Panel title={t('schedule.title')}><div className="schedule-form">
      <label className="checkbox-field"><input type="checkbox" checked={schedule.enabled} onChange={(event) => setSchedule({ ...schedule, enabled: event.target.checked })} />{t(schedule.enabled ? 'schedule.enabled' : 'schedule.disabled')}</label>
      <Field label={t('projects.time')}><input type="time" value={schedule.time} onChange={(event) => setSchedule({ ...schedule, time: event.target.value })} /></Field>
      <Field label={t('projects.timezone')}><input value={schedule.timezone} onChange={(event) => setSchedule({ ...schedule, timezone: event.target.value })} /></Field>
      <Field label={t('workflow.reportLanguage')}><select value={schedule.locale ?? 'zh-CN'} onChange={(event) => setSchedule({ ...schedule, locale: event.target.value as Locale })}><option value="zh-CN">{t('languages.zh')}</option><option value="en-US">{t('languages.en')}</option></select></Field>
      <Button loading={loading === 'save'} onClick={() => void saveSchedule()}>{t('common.save')}</Button>
    </div></Panel>
    <Panel title={t('reports.preview')}>{preview ? <><div className="report-meta"><Badge tone={preview.sent ? 'success' : 'neutral'}>{t(preview.sent ? 'reports.sent' : 'reports.localOnly')}</Badge><time>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(preview.generatedAt))}</time></div><pre className="report-preview">{preview.markdown}</pre></> : <p>{t('reports.empty')}</p>}</Panel>
    <Panel title={t('workflow.reportHistory')}><div className="report-history">{history.map((report) => <details key={report.id ?? report.generatedAt}><summary><time>{new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(report.generatedAt))}</time> · {report.locale} {report.deliveryError ? t('workflow.deliveryFailed') : report.sent ? t('workflow.deliverySuccess') : ''}</summary><pre className="report-preview">{report.markdown}</pre></details>)}</div></Panel>
  </div>
}
