import { CalendarCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProjectConfig } from '../../shared/types'
import { Button, Panel } from './ui'

export function DailySchedule({ project, onView, onToggle }: { project: ProjectConfig; onView(): void; onToggle(enabled: boolean): void }) {
  const { t } = useTranslation()
  return <Panel className="schedule-panel">
    <div className="schedule-content"><span className="schedule-icon"><CalendarCheck size={24} /></span><div><strong>{t('schedule.description', { time: project.dailyReport.time })}</strong><span>{project.notification.type === 'webhook' ? t('schedule.destination', { target: project.notification.target }) : t('schedule.localOnly')}</span></div></div>
    <Button onClick={onView}>{t('schedule.view')}</Button>
    <label className="switch"><input aria-label={t('schedule.title')} type="checkbox" checked={project.dailyReport.enabled} onChange={(event) => onToggle(event.target.checked)} /><span aria-hidden="true" /></label>
  </Panel>
}
