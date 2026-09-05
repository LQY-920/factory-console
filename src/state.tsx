import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ProjectConfig, ProjectInput, ProjectStatus } from '../shared/types'
import { api } from './api'

interface AppState {
  projects: ProjectConfig[]
  selectedProject?: ProjectConfig
  selectedProjectId: string
  setSelectedProjectId(id: string): void
  status?: ProjectStatus
  loadingProjects: boolean
  refreshing: boolean
  errorKey?: string
  refreshProjects(): Promise<void>
  refreshStatus(): Promise<void>
  saveProject(input: ProjectInput, id?: string): Promise<ProjectConfig>
  removeProject(id: string): Promise<void>
}

const StateContext = createContext<AppState | null>(null)

function errorKey(error: unknown, fallback: string): string {
  return typeof error === 'object' && error && 'errorKey' in error ? String((error as { errorKey: string }).errorKey) : fallback
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectConfig[]>([])
  const [selectedProjectId, setSelectedProjectIdState] = useState(() => localStorage.getItem('factory-console.project') ?? '')
  const [status, setStatus] = useState<ProjectStatus>()
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string>()
  const requestVersion = useRef(0)
  const selectedProject = projects.find((project) => project.id === selectedProjectId)

  const setSelectedProjectId = useCallback((id: string) => {
    requestVersion.current++
    setSelectedProjectIdState(id)
    localStorage.setItem('factory-console.project', id)
    setStatus(undefined)
    setError(undefined)
  }, [])

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const next = await api.listProjects()
      setProjects(next)
      setError(undefined)
      setSelectedProjectIdState((current) => {
        const nextId = next.some((project) => project.id === current) ? current : next[0]?.id ?? ''
        if (nextId) localStorage.setItem('factory-console.project', nextId)
        else localStorage.removeItem('factory-console.project')
        return nextId
      })
    } catch (caught) { setError(errorKey(caught, 'errors.loadProjects')) }
    finally { setLoadingProjects(false) }
  }, [])

  const refreshStatus = useCallback(async () => {
    if (!selectedProjectId) { setStatus(undefined); return }
    setRefreshing(true)
    const version = ++requestVersion.current
    try { const next = await api.getStatus(selectedProjectId); if (version === requestVersion.current && next.projectId === selectedProjectId) { setStatus(next); setError(undefined) } }
    catch (caught) { if (version === requestVersion.current) setError(errorKey(caught, 'errors.loadStatus')) }
    finally { if (version === requestVersion.current) setRefreshing(false) }
  }, [selectedProjectId])

  const saveProject = useCallback(async (input: ProjectInput, id?: string) => {
    const saved = id ? await api.updateProject(id, input) : await api.createProject(input)
    await refreshProjects()
    setSelectedProjectId(saved.id)
    const version = ++requestVersion.current
    setRefreshing(true)
    // Saving configuration succeeds independently of slow external status reads.
    void api.getStatus(saved.id).then((next) => { if (version === requestVersion.current && next.projectId === saved.id) setStatus(next) })
      .catch((caught) => { if (version === requestVersion.current) setError(errorKey(caught, 'errors.loadStatus')) })
      .finally(() => { if (version === requestVersion.current) setRefreshing(false) })
    return saved
  }, [refreshProjects, setSelectedProjectId])

  const removeProject = useCallback(async (id: string) => {
    await api.deleteProject(id)
    await refreshProjects()
  }, [refreshProjects])

  useEffect(() => { void refreshProjects() }, [refreshProjects])
  useEffect(() => { void refreshStatus() }, [refreshStatus])

  const value = useMemo<AppState>(() => ({ projects, selectedProject, selectedProjectId, setSelectedProjectId, status, loadingProjects, refreshing, errorKey: error, refreshProjects, refreshStatus, saveProject, removeProject }), [projects, selectedProject, selectedProjectId, setSelectedProjectId, status, loadingProjects, refreshing, error, refreshProjects, refreshStatus, saveProject, removeProject])
  return <StateContext.Provider value={value}>{children}</StateContext.Provider>
}

export function useAppState(): AppState {
  const value = useContext(StateContext)
  if (!value) throw new Error('AppStateProvider is missing')
  return value
}
