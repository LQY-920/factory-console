// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createStore } from './db.js'

const tempRoots: string[] = []
const originalPath = process.env.PATH
const originalWindowsPath = process.env.Path

afterEach(() => {
  process.env.PATH = originalPath
  process.env.Path = originalWindowsPath
  delete process.env.FACTORY_CONSOLE_TEST_GH_SCRIPT
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('real adapter integration with temporary tools', () => {
  it('reads a temporary Git repository plus fake gh and factory CLIs without touching real projects', async () => {
    const root = mkdtempSync(join(tmpdir(), 'factory-console-test-')); tempRoots.push(root)
    const repo = join(root, 'repo'); const bin = join(root, 'bin')
    mkdirSync(join(repo, 'scripts', 'factory'), { recursive: true }); mkdirSync(join(repo, 'docs'), { recursive: true }); mkdirSync(bin)
    writeFileSync(join(repo, 'docs', 'prd.md'), '# Test PRD')
    writeFileSync(join(repo, 'scripts', 'factory', 'factory'), '#!/usr/bin/env bash\nif [[ "$1" == "status" ]]; then echo "[status:todo]"; echo "  #1 Test item"; elif [[ "$1" == "next" ]]; then echo "NEXT=batch-review"; echo "BATCH=test-batch"; echo "Waiting"; elif [[ "$1" == "doctor" ]]; then echo "doctor ok"; fi\n')
    const ghMock = join(bin, 'gh-mock.mjs')
    writeFileSync(ghMock, `const args = process.argv.slice(2);\nif (args[0] === 'auth') process.exit(0);\nif (args[0] !== 'api' || args[1] !== '--method' || args[2] !== 'GET') process.exit(2);\nconst endpoint = args[3];\nif (endpoint.includes('/git/trees/')) { console.error('404'); process.exit(1); }\nconst data = endpoint.includes('/issues?') ? [{ number: 1, title: 'Test issue', state: 'open', labels: [{ name: 'status:todo' }], html_url: 'https://example.test/issues/1' }] : [];\nconsole.log(JSON.stringify(args.includes('--slurp') ? [data] : data));\n`)
    execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
    execFileSync('git', ['config', 'user.email', 'test@example.test'], { cwd: repo })
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo })
    execFileSync('git', ['add', '.'], { cwd: repo })
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo })
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/example/test.git'], { cwd: repo })
    process.env.PATH = `${bin};${originalPath}`
    process.env.Path = `${bin};${originalWindowsPath ?? originalPath}`
    process.env.FACTORY_CONSOLE_TEST_GH_SCRIPT = ghMock
    const store = createStore(':memory:')
    const { app } = createApp({ store })
    const create = await request(app).post('/api/projects').send({
      displayName: 'Temp', enabled: true, localRepoPath: repo, githubRepo: 'example/test', factoryScriptPath: 'scripts/factory/factory', prdPath: 'docs/prd.md', batchName: 'test-batch', defaultBranch: 'main',
      mysql: { host: '', port: 3306, database: '', username: '' }, deploy: { host: '', port: 22, username: '', projectPath: '', domain: '' }, notification: { type: 'none', target: '' }, dailyReport: { enabled: true, time: '09:00', timezone: 'UTC' },
    }).expect(201)
    const status = await request(app).get(`/api/projects/${create.body.id}/status`).expect(200)
    expect(status.body.git).toMatchObject({ state: 'connected', currentBranch: 'main', dirty: false })
    expect(status.body.github).toMatchObject({ state: 'connected', repo: 'example/test' })
    expect(status.body.factory).toMatchObject({ state: 'connected', nextCode: 'coding', fields: { SOURCE: 'console-readonly', BATCH: 'test-batch' } })
    expect(status.body.metrics.todo).toBe(1)
    const doctor = await request(app).post(`/api/projects/${create.body.id}/actions/doctor`).send({}).expect(200)
    expect(doctor.body.output).toContain('doctor ok')
    store.close()
  }, 30_000)
})
