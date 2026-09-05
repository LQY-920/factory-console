import { useTranslation } from 'react-i18next'
import type { ProjectStatus } from '../../shared/types'
import { HumanActionQueue } from '../components/HumanActionQueue'

export function TasksPage({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation()
  return <div className="page-stack"><div className="page-heading"><div><h1>{t('nav.tasks')}</h1><p>{t('tasks.subtitle')}</p></div></div><HumanActionQueue actions={status.actions} /></div>
}

