import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ActionId, ProjectConfig } from '../../shared/types'
import { Button } from './ui'

export function ConfirmActionDialog({ project, action, loading, onClose, onConfirm }: { project: ProjectConfig; action: ActionId; loading: boolean; onClose(): void; onConfirm(): void }) {
  const { t } = useTranslation()
  const command = action === 'batchStart' ? `factory batch start ${project.batchName} --prd ${project.prdPath}` : `factory review collect ${project.batchName}`
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <header><span className="dialog__warning"><AlertTriangle size={22} /></span><h2 id="confirm-title">{t('confirm.title')}</h2><button className="icon-button" onClick={onClose} aria-label={t('common.close')}><X size={20} /></button></header>
      <dl className="confirm-grid"><dt>{t('confirm.project')}</dt><dd>{project.displayName}</dd><dt>{t('confirm.prd')}</dt><dd><code>{project.prdPath}</code></dd><dt>{t('confirm.batch')}</dt><dd><code>{project.batchName}</code></dd><dt>{t('confirm.command')}</dt><dd><code>{command}</code></dd></dl>
      <div className="impact-box"><strong>{t('confirm.impact')}</strong><p>{t(action === 'batchStart' ? 'confirm.impactBatch' : 'confirm.impactCollect')}</p></div>
      <footer><Button onClick={onClose} disabled={loading}>{t('confirm.cancel')}</Button><Button variant="primary" onClick={onConfirm} loading={loading}>{t(loading ? 'confirm.running' : 'confirm.confirm')}</Button></footer>
    </section>
  </div>
}

