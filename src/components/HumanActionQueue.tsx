import { Beaker, ChevronRight, CloudUpload, GitMerge, MessageSquareWarning, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { HumanAction } from '../../shared/types'
import { Badge, Button, EmptyState, Panel } from './ui'

const metadata = {
  review: { icon: UsersRound, tone: 'violet', button: 'reviewButton' }, testing: { icon: Beaker, tone: 'cyan', button: 'testsButton' },
  rework: { icon: MessageSquareWarning, tone: 'warning', button: 'feedbackButton' }, merge: { icon: GitMerge, tone: 'info', button: 'mergeButton' },
  release: { icon: CloudUpload, tone: 'info', button: 'releaseButton' }, deploy: { icon: CloudUpload, tone: 'info', button: 'deployButton' },
} as const

export function HumanActionQueue({ actions }: { actions: HumanAction[] }) {
  const { t } = useTranslation()
  return <Panel title={t('overview.actionsTitle')}>
    {!actions.length ? <EmptyState icon={<UsersRound size={24} />} title={t('overview.noActions')} /> : <div className="action-list">
      {actions.map((action) => {
        const meta = metadata[action.kind]
        const Icon = meta.icon
        return <div className={`action-row action-row--${meta.tone}`} key={action.id}>
          <span className="action-row__icon"><Icon size={19} /></span>
          <strong>{t(action.titleKey, { count: action.count })}</strong>
          <Badge tone={meta.tone}>{t('pipeline.human')}</Badge>
          <Button onClick={() => action.targetUrl && window.open(action.targetUrl, '_blank', 'noopener,noreferrer')} disabled={!action.targetUrl}>{t(`actions.${meta.button}`)} <ChevronRight size={16} /></Button>
        </div>
      })}
    </div>}
  </Panel>
}

