import { ChevronDown, ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectConfig, RunRecord } from '../../shared/types'
import { api } from '../api'
import { Badge, Button, EmptyState, Panel } from '../components/ui'

export function RunsPage({ projects }: { projects: ProjectConfig[] }) {
  const { t, i18n } = useTranslation()
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('')
  const [expanded, setExpanded] = useState<string>()
  const [error, setError] = useState(false)
  useEffect(() => { let cancelled = false; setError(false); void api.listRuns(projectId || undefined, status || undefined).then((rows) => { if (!cancelled) setRuns(rows) }).catch(() => { if (!cancelled) setError(true) }); return () => { cancelled = true } }, [projectId, status])
  return <div className="page-stack">
    {error ? <p role="alert">{t('errors.loadRuns')}</p> : null}
    <div className="page-heading"><div><h1>{t('runs.title')}</h1></div><div className="filters"><select aria-label={t('runs.project')} value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{t('runs.allProjects')}</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.displayName}</option>)}</select><select aria-label={t('runs.status')} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t('runs.allStatuses')}</option><option value="success">{t('runs.success')}</option><option value="failed">{t('runs.failed')}</option><option value="running">{t('runs.running')}</option></select></div></div>
    <Panel>{!runs.length ? <EmptyState icon={<ScrollText size={27} />} title={t('runs.empty')} /> : <div className="run-table-wrap"><table className="run-table"><thead><tr><th>{t('runs.started')}</th><th>{t('runs.project')}</th><th>{t('runs.action')}</th><th>{t('runs.status')}</th><th>{t('runs.exitCode')}</th><th>{t('runs.output')}</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td><time>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(run.startedAt))}</time></td><td>{projects.find((project) => project.id === run.projectId)?.displayName ?? run.projectId.slice(0, 8)}</td><td>{t(`audit.${run.action}`, { defaultValue: t(`command.${run.action}`, { defaultValue: run.action }) })}</td><td><Badge tone={run.status === 'success' ? 'success' : run.status === 'failed' ? 'danger' : 'info'}>{t(`runs.${run.status}`)}</Badge></td><td>{run.exitCode ?? '—'}</td><td><Button className="output-button" onClick={() => setExpanded(expanded === run.id ? undefined : run.id)}>{t('runs.viewOutput')}<ChevronDown size={15} /></Button>{expanded === run.id ? <div><code>{run.command}</code><p>{t('workflow.rawOutput')}</p><pre className="run-output">{run.output === 'report_delivered' ? t('workflow.deliverySuccess') : run.output === 'notification_failed' ? t('workflow.deliveryFailed') : run.output || '—'}</pre></div> : null}</td></tr>)}</tbody></table></div>}</Panel>
  </div>
}
