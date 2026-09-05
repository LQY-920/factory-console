import { Database, Languages, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Locale } from '../../shared/types'
import { Badge, Panel } from '../components/ui'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const setLocale = (locale: Locale) => void i18n.changeLanguage(locale)
  return <div className="page-stack"><div className="page-heading"><div><h1>{t('settings.title')}</h1></div></div><div className="settings-grid">
    <Panel title={t('settings.language')}><div className="setting-row"><Languages size={22} /><div className="segmented"><button className={i18n.language === 'zh-CN' ? 'active' : ''} onClick={() => setLocale('zh-CN')}>中文</button><button className={i18n.language === 'en-US' ? 'active' : ''} onClick={() => setLocale('en-US')}>English</button></div></div></Panel>
    <Panel title={t('settings.storage')}><div className="setting-row"><Database size={22} /><code>.data/factory-console.sqlite</code></div></Panel>
    <Panel title={t('settings.security')}><div className="setting-copy"><ShieldCheck size={24} /><p>{t('settings.securityText')}</p></div></Panel>
    <Panel title={t('settings.demo')}><div className="setting-row"><Badge tone="neutral">{t('settings.demoOff')}</Badge></div></Panel>
    <Panel title={t('settings.about')}><p>{t('settings.aboutText')}</p></Panel>
  </div></div>
}

