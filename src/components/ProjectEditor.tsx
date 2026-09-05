import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectConfig, ProjectInput } from '../../shared/types'
import { Button, Field, Panel } from './ui'

export const emptyProject: ProjectInput = {
  displayName: '', enabled: true, localRepoPath: '', githubRepo: '', factoryScriptPath: 'scripts/factory/factory', prdPath: 'docs/prd.md', batchName: 'mvp-prd', defaultBranch: 'main',
  mysql: { host: 'localhost', port: 3306, database: '', username: '', passwordSecretRef: '' },
  deploy: { host: '', port: 22, username: '', projectPath: '', domain: '', credentialSecretRef: '' },
  notification: { type: 'none', target: '', webhookSecretRef: '' },
  dailyReport: { enabled: true, time: '09:00', timezone: 'Asia/Shanghai' },
}

function toInput(project?: ProjectConfig): ProjectInput {
  if (!project) return structuredClone(emptyProject)
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = project
  return structuredClone(input)
}

export function ProjectEditor({ project, onSave, onCancel }: { project?: ProjectConfig; onSave(input: ProjectInput): Promise<void>; onCancel(): void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState<ProjectInput>(() => toInput(project))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setValue(toInput(project)), [project])
  const set = <K extends keyof ProjectInput>(key: K, next: ProjectInput[K]) => setValue((current) => ({ ...current, [key]: next }))
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    try { await onSave(value) } catch (caught) { setError(t(caught && typeof caught === 'object' && 'errorKey' in caught ? String(caught.errorKey) : 'errors.invalidProject')) }
    finally { setSaving(false) }
  }
  return <Panel title={t(project ? 'projects.edit' : 'projects.add')}>
    <form className="project-form" onSubmit={submit}>
      <div className="form-grid">
        <Field label={t('projects.displayName')}><input required value={value.displayName} onChange={(event) => set('displayName', event.target.value)} /></Field>
        <Field label={t('projects.localRepoPath')} wide><input required value={value.localRepoPath} onChange={(event) => set('localRepoPath', event.target.value)} placeholder="D:\\projects\\my-project" /></Field>
        <Field label={t('projects.githubRepo')}><input value={value.githubRepo} onChange={(event) => set('githubRepo', event.target.value)} placeholder="owner/repository" /></Field>
        <Field label={t('projects.factoryScriptPath')}><input required value={value.factoryScriptPath} onChange={(event) => set('factoryScriptPath', event.target.value)} /></Field>
        <Field label={t('projects.prdPath')}><input required value={value.prdPath} onChange={(event) => set('prdPath', event.target.value)} /></Field>
        <Field label={t('projects.batchName')}><input required value={value.batchName} onChange={(event) => set('batchName', event.target.value)} /></Field>
        <Field label={t('projects.defaultBranch')}><input required value={value.defaultBranch} onChange={(event) => set('defaultBranch', event.target.value)} /></Field>
        <label className="checkbox-field"><input type="checkbox" checked={value.enabled} onChange={(event) => set('enabled', event.target.checked)} />{t('projects.enabled')}</label>
      </div>
      <fieldset><legend>{t('projects.mysqlTitle')}</legend><div className="form-grid">
        <Field label={t('projects.host')}><input value={value.mysql.host} onChange={(event) => set('mysql', { ...value.mysql, host: event.target.value })} /></Field>
        <Field label={t('projects.port')}><input type="number" value={value.mysql.port} onChange={(event) => set('mysql', { ...value.mysql, port: Number(event.target.value) })} /></Field>
        <Field label={t('projects.database')}><input value={value.mysql.database} onChange={(event) => set('mysql', { ...value.mysql, database: event.target.value })} /></Field>
        <Field label={t('projects.username')}><input value={value.mysql.username} onChange={(event) => set('mysql', { ...value.mysql, username: event.target.value })} /></Field>
        <Field label={t('projects.passwordSecretRef')} wide><input value={value.mysql.passwordSecretRef} onChange={(event) => set('mysql', { ...value.mysql, passwordSecretRef: event.target.value })} placeholder="MY_PROJECT_MYSQL_PASSWORD" autoComplete="off" /></Field>
      </div></fieldset>
      <fieldset><legend>{t('projects.deployTitle')}</legend><div className="form-grid">
        <Field label={t('projects.host')}><input value={value.deploy.host} onChange={(event) => set('deploy', { ...value.deploy, host: event.target.value })} /></Field>
        <Field label={t('projects.port')}><input type="number" value={value.deploy.port} onChange={(event) => set('deploy', { ...value.deploy, port: Number(event.target.value) })} /></Field>
        <Field label={t('projects.username')}><input value={value.deploy.username} onChange={(event) => set('deploy', { ...value.deploy, username: event.target.value })} /></Field>
        <Field label={t('projects.projectPath')}><input value={value.deploy.projectPath} onChange={(event) => set('deploy', { ...value.deploy, projectPath: event.target.value })} /></Field>
        <Field label={t('projects.domain')}><input value={value.deploy.domain} onChange={(event) => set('deploy', { ...value.deploy, domain: event.target.value })} /></Field>
        <Field label={t('projects.credentialSecretRef')}><input value={value.deploy.credentialSecretRef} onChange={(event) => set('deploy', { ...value.deploy, credentialSecretRef: event.target.value })} placeholder="MY_PROJECT_DEPLOY_CREDENTIAL" autoComplete="off" /></Field>
      </div></fieldset>
      <fieldset><legend>{t('projects.notificationTitle')}</legend><div className="form-grid">
        <Field label={t('projects.notificationType')}><select value={value.notification.type} onChange={(event) => set('notification', { ...value.notification, type: event.target.value as 'none' | 'webhook' })}><option value="none">{t('projects.none')}</option><option value="webhook">{t('projects.webhook')}</option></select></Field>
        <Field label={t('projects.target')} wide><input autoComplete="off" placeholder="MY_PROJECT_WEBHOOK_URL" value={value.notification.target} onChange={(event) => set('notification', { ...value.notification, target: event.target.value })} /></Field>
        <Field label={t('projects.webhookSecretRef')} wide><input value={value.notification.webhookSecretRef} onChange={(event) => set('notification', { ...value.notification, webhookSecretRef: event.target.value })} placeholder="MY_PROJECT_WEBHOOK_SECRET" autoComplete="off" /></Field>
      </div></fieldset>
      <fieldset><legend>{t('projects.dailyTitle')}</legend><div className="form-grid">
        <Field label={t('projects.time')}><input type="time" value={value.dailyReport.time} onChange={(event) => set('dailyReport', { ...value.dailyReport, time: event.target.value })} /></Field>
        <Field label={t('projects.timezone')}><input value={value.dailyReport.timezone} onChange={(event) => set('dailyReport', { ...value.dailyReport, timezone: event.target.value })} /></Field>
      </div></fieldset>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <footer className="form-actions"><Button type="button" onClick={onCancel}>{t('projects.cancel')}</Button><Button variant="primary" type="submit" loading={saving}>{t('projects.save')}</Button></footer>
    </form>
  </Panel>
}
