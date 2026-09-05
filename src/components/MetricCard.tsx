import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: number | null; icon: LucideIcon; tone: 'blue' | 'violet' | 'cyan' | 'amber' }) {
  const { t, i18n } = useTranslation()
  return <article className={`metric metric--${tone}`}>
    <span className="metric__icon"><Icon size={31} strokeWidth={1.8} /></span>
    <span className="metric__copy"><span>{label}</span><strong title={value === null ? t('status.unavailable') : undefined}>{value === null ? '—' : new Intl.NumberFormat(i18n.language).format(value)}</strong></span>
  </article>
}
