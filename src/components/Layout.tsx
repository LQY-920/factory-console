import { useState, type ReactNode } from 'react'
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
  const degraded = Boolean(status && [status.git.state, status.github.state, status.factory.state].some((state) => state === 'unavailable'))
  const setLocale = (locale: Locale) => void i18n.changeLanguage(locale)

  const navigate = (id: PageId) => { onNavigate(id); setMobileOpen(false) }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
      <div className="brand-row"><span className="brand">Factory Console</span><button className="icon-button mobile-only" onClick={() => setMobileOpen(false)} aria-label={t('common.close')}><X size={20} /></button></div>
      <nav className="sidebar__nav" aria-label={t('top.language')}>
        {nav.map(([id, Icon]) => <button key={id} className={`nav-item ${page === id ? 'nav-item--active' : ''}`} onClick={() => navigate(id)}>
          <Icon size={22} strokeWidth={1.8} aria-hidden="true" /><span>{t(`nav.${id}`)}</span>
        </button>)}
      </nav>
      <div className="sidebar__footer"><button className={`nav-item ${page === 'settings' ? 'nav-item--active' : ''}`} onClick={() => navigate('settings')}><Settings size={22} /><span>{t('nav.settings')}</span></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <button className="icon-button mobile-menu mobile-only" onClick={() => setMobileOpen(true)} aria-label="Menu"><Menu size={21} /></button>
        <label className="project-switcher">
          <FolderGit2 size={20} aria-hidden="true" />
          <select aria-label={t('nav.projects')} value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            {!projects.length ? <option value="">{t('top.noProject')}</option> : null}
            {projects.map((project) => <option value={project.id} key={project.id}>{project.displayName}</option>)}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
        <div className="top-chip top-chip--desktop"><Monitor size={19} /><span>{t('top.localProject')}</span></div>
        <div className={`top-chip top-chip--desktop ${degraded ? 'top-chip--warning' : 'top-chip--healthy'}`}><span className="health-dot" /><span>{selectedProject ? t(degraded ? 'top.degraded' : 'top.connected') : t('top.noProject')}</span></div>
        <Button className="refresh-button" onClick={() => void refreshStatus()} loading={refreshing}><RefreshCw size={18} /><span>{t(refreshing ? 'top.refreshing' : 'top.refresh')}</span></Button>
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
