import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays, ChevronDown, Folder, FolderGit2, History, House, Link2, ListTodo, Menu,
  Monitor, Play, RefreshCw, Settings, Workflow, X,
} from 'lucide-react'
import type { Locale } from '../../shared/types'
import { useAppState } from '../state'
import { Button } from './ui'

export type PageId = 'overview' | 'projects' | 'pipeline' | 'tasks' | 'connections' | 'reports' | 'runs' | 'settings'

const nav = [
  ['overview', House], ['projects', Folder], ['pipeline', Workflow], ['tasks', ListTodo],
  ['connections', Link2], ['reports', CalendarDays], ['runs', History],
] as const

export function Layout({ page, onNavigate, onStartBatch, children }: { page: PageId; onNavigate(id: PageId): void; onStartBatch(): void; children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const { projects, selectedProjectId, setSelectedProjectId, selectedProject, status, refreshing, refreshStatus } = useAppState()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const sidebar = useRef<HTMLElement>(null)
  const menu = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const update = () => { setNarrow(media.matches); if (!media.matches) setMobileOpen(false) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!mobileOpen || !narrow) return
    const trigger = menu.current
    sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => trigger?.focus()
  }, [mobileOpen, narrow])
  const degraded = Boolean(status && [status.git.state, status.github.state, status.factory.state].some((state) => state === 'unavailable'))
  const setLocale = (locale: Locale) => void i18n.changeLanguage(locale)

  const navigate = (id: PageId) => { onNavigate(id); setMobileOpen(false) }
  return <div className="app-shell">
    <aside ref={sidebar} id="primary-navigation" inert={narrow && !mobileOpen} className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`} onKeyDown={(event) => {
      if (!narrow || !mobileOpen) return
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false) }
      if (event.key === 'Tab') {
        const buttons = [...(sidebar.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        const first = buttons[0]; const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus()}
        if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus()}
      }
    }}>
      <div className="brand-row"><span className="brand">Factory Console</span><button className="icon-button mobile-only" onClick={() => setMobileOpen(false)} aria-label={t('common.close')}><X size={20} /></button></div>
      <nav className="sidebar__nav" aria-label={t('workflow.navigation')}>
        {nav.map(([id, Icon]) => <button key={id} aria-current={page === id ? 'page' : undefined} className={`nav-item ${page === id ? 'nav-item--active' : ''}`} onClick={() => navigate(id)}>
          <Icon size={22} strokeWidth={1.8} aria-hidden="true" /><span>{t(`nav.${id}`)}</span>
        </button>)}
      </nav>
      <div className="sidebar__footer"><button className={`nav-item ${page === 'settings' ? 'nav-item--active' : ''}`} onClick={() => navigate('settings')}><Settings size={22} /><span>{t('nav.settings')}</span></button></div>
    </aside>
    <div className="workspace" inert={narrow && mobileOpen}>
      <header className="topbar">
        <button ref={menu} className="icon-button mobile-menu mobile-only" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="primary-navigation" aria-label={t('workflow.menu')}><Menu size={21} /></button>
        <label className="project-switcher">
          <FolderGit2 size={20} aria-hidden="true" />
          <select aria-label={t('nav.projects')} value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            {!projects.length ? <option value="">{t('top.noProject')}</option> : null}
            {projects.map((project) => <option value={project.id} key={project.id}>{project.displayName}</option>)}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
        <div className="top-chip top-chip--desktop"><Monitor size={19} /><span>{t('top.localProject')}</span></div>
        <div className={`top-chip top-chip--desktop ${degraded ? 'top-chip--warning' : 'top-chip--healthy'}`}><span className="health-dot" /><span>{selectedProject ? t(!status ? 'top.refreshing' : degraded ? 'top.degraded' : 'top.connected') : t('top.noProject')}</span></div>
        <Button aria-label={t('top.refresh')} className="refresh-button" onClick={() => void refreshStatus()} loading={refreshing}><RefreshCw size={18} /><span>{t(refreshing ? 'top.refreshing' : 'top.refresh')}</span></Button>
        <div className="topbar__spacer" />
        <div className="language-toggle" aria-label={t('top.language')}>
          <button className={i18n.language === 'zh-CN' ? 'active' : ''} onClick={() => setLocale('zh-CN')}>{t('top.zhLabel')}</button><span>/</span><button className={i18n.language === 'en-US' ? 'active' : ''} onClick={() => setLocale('en-US')}>EN</button>
        </div>
        <Button variant="primary" onClick={onStartBatch} disabled={!selectedProject}><Play size={19} fill="currentColor" /><span>{t('top.startBatch')}</span></Button>
      </header>
      <main className="content" id="main-content">{children}</main>
    </div>
    {mobileOpen ? <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label={t('common.close')} /> : null}
  </div>
}
