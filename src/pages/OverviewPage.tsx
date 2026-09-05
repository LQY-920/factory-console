import { Beaker, ClipboardList, ShieldCheck, UsersRound, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProjectConfig, ProjectStatus } from '../../shared/types'
import { ConnectionPanel } from '../components/ConnectionPanel'
import { DailySchedule } from '../components/DailySchedule'
import { HumanActionQueue } from '../components/HumanActionQueue'
import { MetricCard } from '../components/MetricCard'
import { PipelineStepper } from '../components/PipelineStepper'

export function OverviewPage({ project, status, onReports, onToggleSchedule }: { project: ProjectConfig; status: ProjectStatus; onReports(): void; onToggleSchedule(enabled: boolean): void }) {
  const { t, i18n } = useTranslation()
  return <div className="overview-page">
    <div className="metrics-grid">
      <MetricCard label={t('metrics.todo')} value={status.metrics.todo} icon={ClipboardList} tone="blue" />
      <MetricCard label={t('metrics.review')} value={status.metrics.review} icon={UsersRound} tone="violet" />
      <MetricCard label={t('metrics.testing')} value={status.metrics.testing} icon={Beaker} tone="cyan" />
      <MetricCard label={t('metrics.rework')} value={status.metrics.rework} icon={Wrench} tone="amber" />
    </div>
    <PipelineStepper steps={status.pipeline} batchName={project.batchName} defaultBranch={project.defaultBranch} />
    <div className="operations-grid">
      <ConnectionPanel project={project} status={status} compact />
      <div className="operations-stack"><HumanActionQueue actions={status.actions} unavailable={status.github.state !== 'connected'} /><DailySchedule project={project} onView={onReports} onToggle={onToggleSchedule} /></div>
    </div>
    <div className="security-banner"><ShieldCheck size={27} /><span>{t('overview.security')}</span><small>{t('overview.refreshed', { time: new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(status.refreshedAt)) })}</small></div>
  </div>
}
