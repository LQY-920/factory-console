import { Activity, ClipboardCopy, PlayCircle, TerminalSquare } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActionId, ProjectConfig, ProjectStatus } from '../../shared/types'
import { PipelineStepper } from '../components/PipelineStepper'
import { Badge, Button, Panel } from '../components/ui'

export function PipelinePage({ project, status, onAction }: { project: ProjectConfig; status: ProjectStatus; onAction(action: ActionId): void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const fields = Object.entries(status.factory.fields)
  const copyPrompt = async () => {
    setCopyFailed(false)
    try {
    await navigator.clipboard.writeText(t('command.startPrompt', { batch: project.batchName }))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
    } catch { setCopyFailed(true) }
  }
  return <div className="page-stack">
    <div className="page-heading"><div><h1>{t('nav.pipeline')}</h1><p>{t(`next.${status.factory.nextCode ?? 'unavailable'}`)}</p><small>{t('workflow.readonly')}</small></div><div className="heading-actions"><Button onClick={() => void copyPrompt()}><ClipboardCopy size={17} />{t(copied ? 'command.copied' : 'command.copyPrompt')}</Button><Button onClick={() => onAction('doctor')}><Activity size={17} />{t('command.doctor')}</Button><Button onClick={() => onAction('reviewCollect')}><PlayCircle size={17} />{t('actions.collect')}</Button></div></div>
    {copyFailed ? <p role="alert">{t('workflow.copyFailed')}</p> : null}
    <PipelineStepper steps={status.pipeline} batchName={project.batchName} defaultBranch={project.defaultBranch} />
    <div className="two-column-grid">
      <Panel title={t('pipeline.machineFields')}><div className="machine-fields">{fields.length ? fields.map(([key, value]) => <div key={key}><span>{key}</span><code>{value}</code></div>) : <p>{t('pipeline.noMachineFields')}</p>}</div></Panel>
      <Panel title={t('pipeline.toolHealth')}><div className="tool-health"><div><TerminalSquare size={20} /><span>Git</span><Badge tone={status.git.state === 'connected' ? 'success' : 'warning'}>{t(`connection.${status.git.state}`)}</Badge></div><div><TerminalSquare size={20} /><span>GitHub CLI</span><Badge tone={status.github.state === 'connected' ? 'success' : 'warning'}>{t(`connection.${status.github.state}`)}</Badge></div><div><TerminalSquare size={20} /><span>Factory</span><Badge tone={status.factory.state === 'connected' ? 'success' : 'warning'}>{t(`connection.${status.factory.state}`)}</Badge></div></div></Panel>
    </div>
  </div>
}
