import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef } from 'react'
import type { ActionId, ProjectConfig } from '../../shared/types'
import { Button } from './ui'

export function ConfirmActionDialog({ project, action, loading, onClose, onConfirm }: { project: ProjectConfig; action: ActionId; loading: boolean; onClose(): void; onConfirm(): void }) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const shell = document.querySelector<HTMLElement>('.app-shell')
    if (shell) shell.inert = true
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (shell) shell.inert = false; previous?.focus() }
  }, [])
  const command = action === 'batchStart' ? `bash ${JSON.stringify(project.factoryScriptPath.replaceAll('\\', '/'))} batch start ${project.batchName} --prd ${JSON.stringify(project.prdPath)}` : `bash ${JSON.stringify(project.factoryScriptPath.replaceAll('\\', '/'))} review collect ${project.batchName}`
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => !loading && event.currentTarget === event.target && onClose()}>
    <section ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={(event) => {
      if (event.key === 'Escape' && !loading) { event.preventDefault(); close.current() }
      if (event.key === 'Tab') {
        const nodes = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
        const first = nodes[0]; const last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
      <header><span className="dialog__warning"><AlertTriangle size={22} /></span><h2 id="confirm-title">{t('confirm.title')}</h2><button className="icon-button" onClick={onClose} disabled={loading} aria-label={t('common.close')}><X size={20} /></button></header>
      <dl className="confirm-grid"><dt>{t('confirm.project')}</dt><dd>{project.displayName}</dd><dt>{t('confirm.prd')}</dt><dd><code>{project.prdPath}</code></dd><dt>{t('confirm.batch')}</dt><dd><code>{project.batchName}</code></dd><dt>{t('confirm.command')}</dt><dd><code>{command}</code></dd></dl>
      <div className="impact-box"><strong>{t('confirm.impact')}</strong><p>{t(action === 'batchStart' ? 'confirm.impactBatch' : 'confirm.impactCollect')}</p></div>
      <footer><Button onClick={onClose} disabled={loading}>{t('confirm.cancel')}</Button><Button variant="primary" onClick={onConfirm} loading={loading}>{t(loading ? 'confirm.running' : 'confirm.confirm')}</Button></footer>
    </section>
  </div>
}
