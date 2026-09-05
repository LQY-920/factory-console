import { FolderPlus, Pencil, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectConfig, ProjectInput, ValidationResult } from '../../shared/types'
import { api } from '../api'
import { ProjectEditor } from '../components/ProjectEditor'
import { Badge, Button, EmptyState, Panel } from '../components/ui'
import { useAppState } from '../state'

export function ProjectsPage({ connectionsOnly = false }: { connectionsOnly?: boolean }) {
  const { t } = useTranslation()
  const { projects, selectedProject, setSelectedProjectId, saveProject, removeProject } = useAppState()
  const [editing, setEditing] = useState<ProjectConfig | 'new' | null>(connectionsOnly && selectedProject ? selectedProject : null)
  const [validation, setValidation] = useState<ValidationResult>()
  const [validating, setValidating] = useState('')
  const [validatedName, setValidatedName] = useState('')
  const [error, setError] = useState(false)
  const save = async (input: ProjectInput) => { await saveProject(input, editing && editing !== 'new' ? editing.id : undefined); setEditing(null) }
  const validate = async (project: ProjectConfig) => { setValidating(project.id); setValidation(undefined); setError(false); try { setValidation(await api.validateProject(project.id)); setValidatedName(project.displayName) } catch { setError(true) } finally { setValidating('') } }
  if (editing) return <div className="page-stack"><ProjectEditor project={editing === 'new' ? undefined : editing} onSave={save} onCancel={() => setEditing(null)} /></div>
  return <div className="page-stack">
    {error ? <p role="alert">{t('errors.network')}</p> : null}
    <div className="page-heading"><div><h1>{t(connectionsOnly ? 'nav.connections' : 'projects.title')}</h1><p>{t('projects.subtitle')}</p></div><Button variant="primary" onClick={() => setEditing('new')}><FolderPlus size={18} />{t('projects.add')}</Button></div>
    {!projects.length ? <Panel><EmptyState icon={<FolderPlus size={28} />} title={t('projects.empty')} action={<Button variant="primary" onClick={() => setEditing('new')}>{t('projects.add')}</Button>} /></Panel> : <div className="project-list">
      {projects.map((project) => <Panel className={`project-list-item ${selectedProject?.id === project.id ? 'project-list-item--active' : ''}`} key={project.id}>
        <button className="project-list-item__main" onClick={() => setSelectedProjectId(project.id)}><span className="project-avatar">{project.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{project.displayName}</strong><code>{project.localRepoPath}</code></span></button>
        <Badge tone={project.enabled ? 'success' : 'neutral'}>{t(project.enabled ? 'schedule.enabled' : 'schedule.disabled')}</Badge>
        <Button onClick={() => void validate(project)} loading={validating === project.id} disabled={Boolean(validating)}><Search size={17} />{t('projects.validate')}</Button>
        <Button onClick={() => setEditing(project)}><Pencil size={17} />{t('projects.edit')}</Button>
        <Button variant="danger" onClick={() => { if (window.confirm(t('projects.confirmDelete', { name: project.displayName }))) void removeProject(project.id).catch(() => setError(true)) }}><Trash2 size={17} />{t('projects.delete')}</Button>
      </Panel>)}
    </div>}
    {validation ? <Panel title={`${t('validation.title')} · ${validatedName}`}><div className="validation-summary"><Badge tone={validation.valid ? 'success' : 'warning'}>{t(validation.valid ? 'validation.valid' : 'validation.invalid')}</Badge></div><div className="check-grid">{validation.checks.map((check) => <div key={check.key}><span className={check.ok ? 'check-dot check-dot--ok' : 'check-dot'} /> <strong>{t(`validation.${check.key}`)}</strong><span>{t(`diagnostics.${check.message}`, { defaultValue: t('status.unavailable') })}</span></div>)}</div></Panel> : null}
  </div>
}
