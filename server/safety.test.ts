// @vitest-environment node
import { resolve } from 'node:path'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { createStore } from './db.js'
import { EnvironmentSecretProvider, redactSecrets } from './security.js'
import { readFactoryState } from './status.js'
import * as commands from './commands.js'
import type { ActionId, ProjectInput } from '../shared/types.js'

const input: ProjectInput = {
  displayName: 'Safety fixture', enabled: true, localRepoPath: resolve('.'), factoryScriptPath: '.codex/review/fake-factory',
  prdPath: 'README.md', batchName: 'safety', defaultBranch: 'main',
  mysql: { host: '', port: 3306, database: '', username: '', passwordSecretRef: '' },
  deploy: { host: '', port: 22, username: '', projectPath: '', domain: '', credentialSecretRef: '' },
  notification: { type: 'none', target: '', webhookSecretRef: '' },
  dailyReport: { enabled: false, time: '09:00', timezone: 'UTC' },
}
afterEach(() => vi.restoreAllMocks())

describe('security and real configuration contract', () => {
  it('creates without credentials, rejects secrets and invalid inputs, audits CRUD', async () => {
    const store = createStore(':memory:'); const { app } = createApp({ store })
    try {
      const created = await request(app).post('/api/projects').send(input).expect(201)
      expect(created.body.mysql.passwordSecretRef).toBeUndefined()
      await request(app).put(`/api/projects/${created.body.id}`).send({ ...input, displayName: 'Updated' }).expect(200)
      for (const patch of [
        { localRepoPath: '.' }, { factoryScriptPath: '-c' }, { dailyReport: { ...input.dailyReport, timezone: 'Not/A_Timezone' } },
        { notification: { type: 'webhook', target: 'https://example.invalid/hooks/SYNTHETIC', webhookSecretRef: 'REF_SECRET' } },
      ]) await request(app).post('/api/projects').send({ ...input, ...patch }).expect(400)
      await request(app).post('/api/projects').set('Origin', 'https://example.invalid').send(input).expect(403)
      await request(app).get('/api/projects').set('Host', 'example.invalid').expect(403)
      store.saveReport({projectId:created.body.id, generatedAt:new Date().toISOString(), markdown:'Synthetic report', sent:false, notificationConfigured:false})
      store.createRun(created.body.id, 'doctor', 'factory doctor')
      await request(app).delete(`/api/projects/${created.body.id}`).expect(204)
      expect(store.listReports(created.body.id)).toHaveLength(0)
      expect(store.listRuns(created.body.id).some((run) => run.action === 'doctor')).toBe(false)
      expect(store.listRuns().map((run) => run.action)).toEqual(expect.arrayContaining(['projectCreate', 'projectUpdate', 'projectDelete']))
    } finally { store.close() }
  })
  it.each(['constructor', 'toString', '__proto__', 'valueOf', 'unknown'])('rejects %s at both command and HTTP boundaries', async (action) => {
    const store = createStore(':memory:'); const project = store.createProject(input); const { app } = createApp({ store })
    try {
      expect(() => commands.buildActionCommand(project, action as ActionId)).toThrow('action_not_allowed')
      await request(app).post(`/api/projects/${project.id}/actions/${action}`).send({}).expect(400)
      expect(store.listRuns()).toHaveLength(0)
      await request(app).post(`/api/projects/${project.id}/actions/batchStart`).send({}).expect(409)
    } finally { store.close() }
  })
  it('does not invoke the mutating next entrypoint while reading Factory status', async () => {
    const store = createStore(':memory:'); const project = store.createProject(input)
    const run = vi.spyOn(commands, 'runCommand').mockResolvedValue({ exitCode: 0, stdout: '[status:todo]\n#1 item', stderr: '', timedOut: false })
    try {
      await readFactoryState(project, new EnvironmentSecretProvider())
      expect(run).toHaveBeenCalledTimes(1)
      expect(run.mock.calls[0][0].args).toEqual(['.codex/review/fake-factory', 'status'])
    } finally { store.close() }
  })
  it('redacts configured secrets even when short or unlabelled', () => {
    expect(redactSecrets('abc def abc', ['abc'])).toBe('[REDACTED] def [REDACTED]')
  })
})
