import { Bell, Cloud, Database, FileText, FolderGit2, Github, TerminalSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProjectConfig, ProjectStatus } from '../../shared/types'
import { Badge, Panel } from './ui'

export function ConnectionPanel({ project, status, compact = false }: { project: ProjectConfig; status?: ProjectStatus; compact?: boolean }) {
  const { t } = useTranslation()
  const rows = [
    { key: 'localRepo', icon: FolderGit2, value: project.localRepoPath, state: status?.git.state ?? 'unavailable', detail: status?.git.currentBranch },
    { key: 'github', icon: Github, value: status?.github.repo ?? project.githubRepo ?? '', state: status?.github.state ?? 'notConfigured', detail: undefined },
    { key: 'prdBatch', icon: FileText, value: `${project.prdPath} · ${project.batchName}`, state: 'configured', detail: undefined },
    { key: 'factory', icon: TerminalSquare, value: project.factoryScriptPath, state: status?.factory.state ?? 'unavailable', detail: undefined },
    { key: 'mysql', icon: Database, value: project.mysql.host ? `${project.mysql.host}:${project.mysql.port}/${project.mysql.database}` : '', state: status?.secrets.mysqlConfigured ? 'configured' : 'notConfigured', detail: undefined },
    { key: 'deploy', icon: Cloud, value: project.deploy.host || project.deploy.domain, state: status?.secrets.deployConfigured ? 'configured' : 'notConfigured', detail: undefined },
    { key: 'notification', icon: Bell, value: project.notification.target, state: status?.secrets.webhookConfigured ? 'configured' : 'notConfigured', detail: undefined },
  ] as const
  const visible = compact ? rows.slice(0, 6) : rows
  return <Panel title={t('overview.connectionTitle')}>
    <div className="connection-list">
      {visible.map(({ key, icon: Icon, value, state, detail }) => <div className="connection-row" key={key}>
        <Icon size={20} aria-hidden="true" />
        <span className="connection-row__label">{t(`connection.${key}`)}</span>
        <span className="connection-row__value" title={value}>{value || t('connection.notConfigured')}{detail ? ` · ${detail}` : ''}</span>
        <Badge tone={state === 'connected' ? 'success' : state === 'configured' ? 'info' : state === 'unavailable' ? 'warning' : 'neutral'}>{t(`connection.${state}`)}</Badge>
      </div>)}
    </div>
  </Panel>
}
