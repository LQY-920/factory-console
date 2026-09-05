// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../shared/types.js'
import { ACTION_ALLOWLIST, buildActionCommand } from './commands.js'

const project: ProjectConfig = {
  id: 'a', displayName: 'Example', enabled: true, localRepoPath: 'D:\\projects\\example', githubRepo: 'owner/repo', factoryScriptPath: 'scripts/factory/factory', prdPath: 'docs/prd.md', batchName: 'mvp-prd', defaultBranch: 'main',
  mysql: { host: '', port: 3306, database: '', username: '' }, deploy: { host: '', port: 22, username: '', projectPath: '', domain: '' }, notification: { type: 'none', target: '' }, dailyReport: { enabled: true, time: '09:00', timezone: 'Asia/Shanghai' }, createdAt: '', updatedAt: '',
}

describe('command allowlist and injection protection', () => {
  it('contains only named factory operations', () => expect(Object.keys(ACTION_ALLOWLIST).sort()).toEqual(['batchStart', 'doctor', 'reviewCollect']))
  it('uses argument arrays for batch start', () => {
    const command = buildActionCommand(project, 'batchStart')
    expect(command.executable).toBe('bash')
    expect(command.args.slice(-5)).toEqual(['batch', 'start', 'mvp-prd', '--prd', 'docs/prd.md'])
  })
  it('rejects path traversal even if schema validation was bypassed', () => {
    expect(() => buildActionCommand({ ...project, factoryScriptPath: '../outside' }, 'doctor')).toThrow('unsafe_relative_path')
  })
})

