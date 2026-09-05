import type { LucideIcon } from 'lucide-react'

export function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: 'blue' | 'violet' | 'cyan' | 'amber' }) {
  return <article className={`metric metric--${tone}`}>
    <span className="metric__icon"><Icon size={31} strokeWidth={1.8} /></span>
    <span className="metric__copy"><span>{label}</span><strong>{new Intl.NumberFormat().format(value)}</strong></span>
  </article>
}

