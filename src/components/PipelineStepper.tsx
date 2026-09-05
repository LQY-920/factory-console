import { Archive, Beaker, Check, CircleAlert, CloudUpload, Code2, FileText, Inbox, LockKeyhole, Server, UserRoundCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PipelineStep } from '../../shared/types'
import { Panel, Badge } from './ui'

const icons = { prd: FileText, issues: CircleAlert, develop: Code2, collect: Inbox, humanReview: UserRoundCheck, candidateTest: Beaker, release: CloudUpload, deploy: Server, knowledge: Archive }

export function PipelineStepper({ steps, batchName, defaultBranch }: { steps: PipelineStep[]; batchName: string; defaultBranch: string }) {
  const { t, i18n } = useTranslation()
  return <Panel className="pipeline-panel" title={<span className="visually-hidden">{t('pipeline.title')}</span>}>
    <div className="pipeline-steps">
      {steps.map((step, index) => {
        const Icon = icons[step.id as keyof typeof icons] ?? CircleAlert
        return <div className={`pipeline-step pipeline-step--${step.state} pipeline-step--id-${step.id}`} key={step.id}>
          <span className="pipeline-step__label">{t(step.labelKey)}</span>
          <div className="pipeline-step__row">
            <span className="pipeline-step__icon"><Icon size={28} strokeWidth={1.8} />{step.count ? <em>{new Intl.NumberFormat(i18n.language).format(step.count)}</em> : null}</span>
            {index < steps.length - 1 ? <span className={`pipeline-connector pipeline-connector--${step.state}`} /> : null}
          </div>
          {step.state === 'complete' ? <span className="complete-dot"><Check size={15} strokeWidth={3} /></span> : step.state === 'pending' ? <span className="lock-dot"><LockKeyhole size={16} /></span> : <Badge tone={step.state === 'human' ? 'violet' : step.state === 'blocked' ? 'danger' : 'info'}>{t(`pipeline.${step.state}`)}</Badge>}
          {step.detail ? <code className="branch-chip" title={step.detail}>{step.detail}</code> : null}
        </div>
      })}
    </div>
    <div className="pipeline-legend">
      <span><i className="legend-dot legend-dot--blue" /><code>integration/{batchName}</code> {t('pipeline.integrationRole')}</span>
      <span><i className="legend-dot legend-dot--cyan" /><code>candidate/{batchName}</code> {t('pipeline.candidateRole')}</span>
      <span><i className="legend-dot legend-dot--neutral" /><code>{defaultBranch}</code> {t('pipeline.mainRole')}</span>
    </div>
  </Panel>
}
