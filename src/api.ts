import type { ApiError, DailyReportPreview, Locale, ProjectConfig, ProjectInput, ProjectStatus, RunRecord, ValidationResult } from '../shared/types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText, errorKey: 'errors.network' })) as ApiError
    throw Object.assign(new Error(body.error), { errorKey: body.errorKey, status: response.status })
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  listProjects: () => request<ProjectConfig[]>('/api/projects'),
  createProject: (input: ProjectInput) => request<ProjectConfig>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
  updateProject: (id: string, input: ProjectInput) => request<ProjectConfig>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  validateProject: (id: string) => request<ValidationResult>(`/api/projects/${id}/validate`, { method: 'POST', body: '{}' }),
  getStatus: (id: string) => request<ProjectStatus>(`/api/projects/${id}/status`),
  runAction: (id: string, action: string, confirmed = false) => request<RunRecord>(`/api/projects/${id}/actions/${action}`, { method: 'POST', body: JSON.stringify({ confirmed }) }),
  listRuns: (projectId?: string, status?: string) => {
    const params = new URLSearchParams()
    if (projectId) params.set('projectId', projectId)
    if (status) params.set('status', status)
    return request<RunRecord[]>(`/api/runs?${params}`)
  },
  previewReport: (projectId: string, locale: Locale) => request<DailyReportPreview>('/api/reports/daily/preview', { method: 'POST', body: JSON.stringify({ projectId, locale }) }),
  sendReport: (projectId: string, locale: Locale) => request<DailyReportPreview>('/api/reports/daily/send', { method: 'POST', body: JSON.stringify({ projectId, locale }) }),
}

