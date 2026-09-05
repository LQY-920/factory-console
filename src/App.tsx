import { AlertCircle, FolderPlus, LoaderCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionId, ProjectInput } from '../shared/types'
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
  const [confirmAction, setConfirmAction] = useState<ActionId>()
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const navigate = (next: PageId) => { setPage(next); localStorage.setItem('factory-console.page', next) }
  const showToast = (tone: 'success' | 'danger', text: string) => { setToast({ tone, text }); window.setTimeout(() => setToast(undefined), 3500) }
  const runAction = async (action: ActionId, confirmed = false) => {
    if (!state.selectedProject) return
    if ((action === 'batchStart' || action === 'reviewCollect') && !confirmed) { setConfirmAction(action); return }
    setActionLoading(true)
    try {
      await api.runAction(state.selectedProject.id, action, confirmed)
      showToast('success', t('command.success'))
      setConfirmAction(undefined)
      await state.refreshStatus()
    } catch { showToast('danger', t('command.failed')) }
    finally { setActionLoading(false) }
  }
  const saveInput = async (input: ProjectInput, id: string) => { await state.saveProject(input, id); await state.refreshStatus() }
  const toggleSchedule = async (enabled: boolean) => {
    const project = state.selectedProject
    if (!project) return
    const { id, createdAt: _created, updatedAt: _updated, ...input } = project
    await saveInput({ ...input, dailyReport: { ...input.dailyReport, enabled } }, id)
  }

  let content
  if (page === 'projects') content = <ProjectsPage />
  else if (page === 'connections') content = <ProjectsPage connectionsOnly />
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
    {confirmAction && state.selectedProject ? <ConfirmActionDialog project={state.selectedProject} action={confirmAction} loading={actionLoading} onClose={() => setConfirmAction(undefined)} onConfirm={() => void runAction(confirmAction, true)} /> : null}
    {toast ? <div className={`toast toast--${toast.tone}`} role="status">{toast.text}</div> : null}
  </>
}

