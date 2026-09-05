import { AlertCircle, FolderPlus, LoaderCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionId, ProjectConfig, ProjectInput } from '../shared/types'
import { api } from './api'
import { ConfirmActionDialog } from './components/ConfirmActionDialog'
import { Layout, type PageId } from './components/Layout'
import { Button, EmptyState, Panel } from './components/ui'
import { OverviewPage } from './pages/OverviewPage'
import { PipelinePage } from './pages/PipelinePage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReportsPage } from './pages/ReportsPage'
import { RunsPage } from './pages/RunsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'
import { useAppState } from './state'

export default function App() {
  const { t } = useTranslation()
  const state = useAppState()
  const [page, setPage] = useState<PageId>(() => (localStorage.getItem('factory-console.page') as PageId) || 'overview')
  const [confirmAction, setConfirmAction] = useState<{ action: ActionId; project: ProjectConfig }>()
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const navigate = (next: PageId) => { setPage(next); localStorage.setItem('factory-console.page', next) }
  const showToast = (tone: 'success' | 'danger', text: string) => { setToast({ tone, text }); window.setTimeout(() => setToast(undefined), 3500) }
  const runAction = async (action: ActionId, confirmed = false, target = state.selectedProject) => {
    if (!target) return
    if ((action === 'batchStart' || action === 'reviewCollect') && !confirmed) { setConfirmAction({ action, project: target }); return }
    setActionLoading(true)
    try {
      await api.runAction(target.id, action, confirmed)
      showToast('success', 'command.success')
      setConfirmAction(undefined)
      await state.refreshStatus()
    } catch { showToast('danger', 'command.failed') }
    finally { setActionLoading(false) }
  }
  const saveInput = async (input: ProjectInput, id: string) => { await state.saveProject(input, id) }
  const toggleSchedule = async (enabled: boolean) => {
    const project = state.selectedProject
    if (!project) return
    const { id, createdAt: _created, updatedAt: _updated, ...input } = project
    try { await saveInput({ ...input, dailyReport: { ...input.dailyReport, enabled } }, id) } catch { showToast('danger', 'workflow.saveFailed') }
  }

  let content
  if (page === 'projects') content = <ProjectsPage />
  else if (page === 'connections') content = <ProjectsPage key={state.selectedProjectId} connectionsOnly />
  else if (page === 'runs') content = <RunsPage projects={state.projects} />
  else if (page === 'settings') content = <SettingsPage />
  else if (state.loadingProjects) content = <div className="center-state"><LoaderCircle className="spin" size={28} /><span>{t('status.loading')}</span></div>
  else if (!state.selectedProject) content = <Panel><EmptyState icon={<FolderPlus size={30} />} title={t('status.noProject')} action={<Button variant="primary" onClick={() => navigate('projects')}>{t('projects.add')}</Button>} /></Panel>
  else if (state.errorKey && !state.status) content = <Panel><EmptyState icon={<AlertCircle size={30} />} title={t(state.errorKey)} action={<Button onClick={() => void state.refreshStatus()}><RefreshCw size={17} />{t('status.retry')}</Button>} /></Panel>
  else if (!state.status) content = <div className="center-state"><LoaderCircle className="spin" size={28} /><span>{t('status.loading')}</span></div>
  else if (page === 'overview') content = <OverviewPage project={state.selectedProject} status={state.status} onReports={() => navigate('reports')} onToggleSchedule={(enabled) => void toggleSchedule(enabled)} />
  else if (page === 'pipeline') content = <PipelinePage project={state.selectedProject} status={state.status} onAction={(action) => void runAction(action)} />
  else if (page === 'tasks') content = <TasksPage status={state.status} />
  else if (page === 'reports') content = <ReportsPage project={state.selectedProject} onSave={saveInput} />
  else content = null

  return <>
    <Layout page={page} onNavigate={navigate} onStartBatch={() => void runAction('batchStart')}>{content}</Layout>
    {confirmAction ? <ConfirmActionDialog project={confirmAction.project} action={confirmAction.action} loading={actionLoading} onClose={() => setConfirmAction(undefined)} onConfirm={() => void runAction(confirmAction.action, true, confirmAction.project)} /> : null}
    {toast ? <div className={`toast toast--${toast.tone}`} role="status">{t(toast.text)}</div> : null}
  </>
}
