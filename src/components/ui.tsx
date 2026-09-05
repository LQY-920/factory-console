import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

export function Button({ children, variant = 'secondary', loading, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return <button className={`button button--${variant} ${className}`} {...props} disabled={loading || props.disabled}>
    {loading ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : null}
    {children}
  </button>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'success' | 'info' | 'cyan' | 'violet' | 'warning' | 'danger' | 'neutral' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Panel({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return <section className={`panel ${className}`}>
    {title ? <div className="panel__header"><h2>{title}</h2>{action}</div> : null}
    {children}
  </section>
}

export function EmptyState({ icon, title, action }: { icon: ReactNode; title: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-state__icon">{icon}</span><p>{title}</p>{action}</div>
}

export function Field({ label, children, wide = false }: { label: ReactNode; children: ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? 'field--wide' : ''}`}><span>{label}</span>{children}</label>
}
