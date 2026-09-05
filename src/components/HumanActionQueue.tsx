import { Beaker, ChevronRight, CloudUpload, GitMerge, MessageSquareWarning, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { HumanAction } from '../../shared/types'
import { Badge, Button, EmptyState, Panel } from './ui'

const metadata = {
  review: { icon: UsersRound, tone: 'violet', button: 'reviewButton' }, testing: { icon: Beaker, tone: 'cyan', button: 'testsButton' },
  promote: { icon: GitMerge, tone: 'cyan', button: 'promoteButton' },
  rework: { icon: MessageSquareWarning, tone: 'warning', button: 'feedbackButton' }, merge: { icon: GitMerge, tone: 'info', button: 'mergeButton' },
  release: { icon: CloudUpload, tone: 'info', button: 'releaseButton' }, deploy: { icon: CloudUpload, tone: 'info', button: 'deployButton' },
} as const

export function HumanActionQueue({ actions, unavailable = false }: { actions: HumanAction[]; unavailable?: boolean }) {
  const { t } = useTranslation()
  const [opened, setOpened] = useState<string>()
  const [copyState, setCopyState] = useState('')
  return <Panel title={t('overview.actionsTitle')}>
    {unavailable ? <p role="status">{t('workflow.unknownReason')}</p> : !actions.length ? <EmptyState icon={<UsersRound size={24} />} title={t('overview.noActions')} /> : <div className="action-list">
      {actions.map((action) => {
        const meta = metadata[action.kind]
        const Icon = meta.icon
        return <div key={action.id}><div className={`action-row action-row--${meta.tone}`}>
          <span className="action-row__icon"><Icon size={19} /></span>
          <strong>{t(action.titleKey, { count: action.count })}</strong>
          <Badge tone={meta.tone}>{t('pipeline.human')}</Badge>
          <Button onClick={() => action.kind === 'deploy' || !action.targetUrl ? setOpened(action.id) : window.open(action.targetUrl, '_blank', 'noopener,noreferrer')} disabled={!action.targetUrl && !action.items?.length}>{t(`actions.${meta.button}`)} <ChevronRight size={16} /></Button>
        </div>{action.items?.length ? <details className="action-details" open={opened === action.id} onToggle={(event) => { if (event.currentTarget.open) setOpened(action.id); else if (opened === action.id) setOpened(undefined) }}><summary>{t('workflow.details')}</summary>{action.kind === 'deploy' ? <p>{t('workflow.manualWarning')}</p> : null}<ul>{action.items.map((item, index) => <li key={`${item.sourceId}-${index}`}>
          {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> : <span>{item.title}</span>}
          {item.blockedBy?.length ? <p>{t('workflow.blocked')}: {item.blockedBy.map((id) => `#${id}`).join(', ')}</p> : null}
          {item.feedback ? <pre>{item.feedback}</pre> : null}{item.command ? <><pre>{item.command}</pre><Button onClick={() => void navigator.clipboard.writeText(item.command!).then(() => setCopyState('command.copied')).catch(() => setCopyState('workflow.copyFailed'))}>{t('workflow.copies')}</Button></> : action.kind === 'deploy' ? <p>{t('workflow.missingDeploy')}</p> : null}
        </li>)}</ul></details> : null}</div>
      })}
    </div>}
    {copyState ? <p role="status">{t(copyState)}</p> : null}
  </Panel>
}
