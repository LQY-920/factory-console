import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectConfig, ProjectStatus } from '../shared/types'
import i18n from './i18n'
import App from './App'
import { AppStateProvider } from './state'

const projects: ProjectConfig[] = ['alpha', 'beta'].map((name, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index}`, displayName: name, enabled: true, localRepoPath: `D:\\projects\\${name}`, githubRepo: `owner/${name}`, factoryScriptPath: 'scripts/factory/factory', prdPath: 'docs/prd.md', batchName: 'mvp-prd', defaultBranch: 'main',
  mysql: { host: 'localhost', port: 3306, database: name, username: 'app' }, deploy: { host: '', port: 22, username: '', projectPath: '', domain: '' }, notification: { type: 'none', target: '' }, dailyReport: { enabled: true, time: '09:00', timezone: 'Asia/Shanghai' }, createdAt: '', updatedAt: '',
}))

const status: ProjectStatus = {
  projectId: projects[0].id, refreshedAt: new Date().toISOString(), demo: false,
  git: { state: 'connected', currentBranch: 'integration/mvp-prd', dirty: false }, github: { state: 'connected', repo: 'owner/alpha', issues: [{ number: 1, title: 'Issue', labels: ['status:todo'], url: 'https://example.test/1' }], pullRequests: [] }, factory: { state: 'connected', fields: { NEXT: 'batch-review' }, sections: {}, nextCode: 'batch-review' },
  metrics: { todo: 1, review: 0, testing: 0, rework: 0 }, actions: [{ id: 'review', kind: 'review', count: 1, titleKey: 'actions.review', targetUrl: 'https://example.test/pr/1' }],
  secrets: { mysqlConfigured: false, deployConfigured: false, webhookConfigured: false },
  pipeline: ['prd', 'issues', 'develop', 'collect', 'humanReview', 'candidateTest', 'release', 'deploy', 'knowledge'].map((id) => ({ id, labelKey: `pipeline.${id}`, state: id === 'collect' ? 'active' : 'pending' })),
}

function response(body: unknown, statusCode = 200) { return new Response(statusCode === 204 ? null : JSON.stringify(body), { status: statusCode, headers: { 'content-type': 'application/json' } }) }

describe('Factory Console interactions', () => {
  beforeEach(async () => {
    localStorage.clear(); await i18n.changeLanguage('zh-CN')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/projects') return response(projects)
      if (url.includes('/status')) return response({ ...status, projectId: url.includes(projects[1].id) ? projects[1].id : projects[0].id })
      if (url.includes('/actions/batchStart') && init?.method === 'POST') return response({ id: 'run', status: 'success' })
      return response({ error: 'not_found', errorKey: 'errors.internal' }, 404)
    }))
  })

  it('switches projects and locale without losing the selected project', async () => {
    const user = userEvent.setup(); render(<AppStateProvider><App /></AppStateProvider>)
    const selector = await screen.findByRole('combobox', { name: '项目' })
    await user.selectOptions(selector, projects[1].id)
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('combobox', { name: 'Projects' })).toHaveValue(projects[1].id)
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('shows human tasks and requires a second confirmation before batch start', async () => {
    const user = userEvent.setup(); render(<AppStateProvider><App /></AppStateProvider>)
    await screen.findByText('1 个 PR 等待批改')
    await user.click(screen.getByRole('button', { name: /开始批次/ }))
    expect(screen.getByRole('dialog', { name: '确认执行高风险操作' })).toBeInTheDocument()
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/actions/batchStart'))).toBe(false)
    await user.click(screen.getByRole('button', { name: '确认执行' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/actions/batchStart'))).toBe(true))
  })
})
