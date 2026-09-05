import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectConfig } from '../../shared/types'
import '../i18n'
import { ReportsPage } from './ReportsPage'

const project: ProjectConfig = { id: '00000000-0000-4000-8000-000000000000', displayName: 'alpha', enabled: true, localRepoPath: 'D:\\alpha', factoryScriptPath: 'scripts/factory/factory', prdPath: 'docs/prd.md', batchName: 'mvp-prd', defaultBranch: 'main', mysql: { host: '', port: 3306, database: '', username: '' }, deploy: { host: '', port: 22, username: '', projectPath: '', domain: '' }, notification: { type: 'none', target: '' }, dailyReport: { enabled: true, time: '09:00', timezone: 'Asia/Shanghai' }, createdAt: '', updatedAt: '' }

describe('daily report flow', () => {
  it('generates and renders a Markdown preview', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ projectId: project.id, generatedAt: new Date().toISOString(), markdown: '# alpha 开发日报', sent: false, notificationConfigured: false }), { status: 200 })))
    render(<ReportsPage project={project} onSave={vi.fn()} />)
    await user.click(screen.getAllByRole('button', { name: '生成预览' })[0])
    expect(await screen.findByText('# alpha 开发日报')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /发送 Webhook/ })).toBeDisabled()
  })
})

