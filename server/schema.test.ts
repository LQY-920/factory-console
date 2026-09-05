// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { projectInputSchema } from './schema.js'

const valid = {
  displayName: 'Example', enabled: true, localRepoPath: 'D:\\projects\\example', githubRepo: 'owner/repo', factoryScriptPath: 'scripts/factory/factory', prdPath: 'docs/prd.md', batchName: 'mvp-prd', defaultBranch: 'main',
  mysql: { host: 'localhost', port: 3306, database: 'example', username: 'app', passwordSecretRef: 'EXAMPLE_MYSQL_PASSWORD' },
  deploy: { host: '', port: 22, username: '', projectPath: '', domain: '', credentialSecretRef: 'EXAMPLE_DEPLOY_KEY' },
  notification: { type: 'none', target: '', webhookSecretRef: undefined },
  dailyReport: { enabled: true, time: '09:00', timezone: 'Asia/Shanghai' },
}

describe('project configuration validation', () => {
  it('accepts secret references without secret values', () => expect(projectInputSchema.safeParse(valid).success).toBe(true))
  it.each(['../factory', '/bin/bash', 'C:\\factory', 'scripts\nfactory'])('rejects unsafe relative paths: %s', (factoryScriptPath) => {
    expect(projectInputSchema.safeParse({ ...valid, factoryScriptPath }).success).toBe(false)
  })
  it('rejects plaintext-shaped secret references and unknown password fields', () => {
    expect(projectInputSchema.safeParse({ ...valid, mysql: { ...valid.mysql, passwordSecretRef: 'actual-password' } }).success).toBe(false)
    expect(projectInputSchema.safeParse({ ...valid, mysql: { ...valid.mysql, password: 'plaintext' } }).success).toBe(false)
  })
})

