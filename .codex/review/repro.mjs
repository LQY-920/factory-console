/* global structuredClone */
// Deterministic review probes. Real application, in-memory DB, harmless fake CLIs.
import process from 'node:process'
import console from 'node:console'
import request from 'supertest'
import { resolve } from 'node:path'
import { createStore } from '../../dist/server/server/db.js'
import { createApp } from '../../dist/server/server/app.js'
import { projectInputSchema } from '../../dist/server/server/schema.js'
import { calculateHumanActions, readFactoryState } from '../../dist/server/server/status.js'
import { generateDailyReport } from '../../dist/server/server/reports.js'
import { EnvironmentSecretProvider } from '../../dist/server/server/security.js'
import { input } from './fixtures.mjs'

process.env.NODE_ENV = 'test'
process.env.FACTORY_CONSOLE_TEST_GH_SCRIPT = resolve('.codex/review/fake-gh.mjs')
const store = createStore(':memory:')
const { app } = createApp({ store })
const p = store.createProject(input)
const results = []
const record = (id, observed, expected) => results.push({ id, observed, expected })

const blank = structuredClone(input)
blank.mysql.passwordSecretRef = ''
blank.deploy.credentialSecretRef = ''
blank.notification.webhookSecretRef = ''
const blankResponse = await request(app).post('/api/projects').send(blank)
record('R01-empty-secret-form', blankResponse.status, 201)
const confirmation = await request(app).post(`/api/projects/${p.id}/actions/batchStart`).send({})
record('CONTROL-confirmation', confirmation.status, 409)
const unknown = await request(app).post(`/api/projects/${p.id}/actions/constructor`).send({})
record('R02-prototype-allowlist', { status: unknown.status, executedBatchWithoutConfirmation: Boolean(unknown.body.output?.includes('FAKE_ONLY_EXECUTED:batch start')) }, { status: 400, executedBatchWithoutConfirmation: false })

const syntheticWebhook = 'https://example.invalid/hooks/SYNTHETIC-NOT-A-REAL-SECRET'
const webhookResponse = await request(app).post('/api/projects').send({ ...input, notification: { type: 'webhook', target: syntheticWebhook, webhookSecretRef: 'REVIEW_FAKE_WEBHOOK' } })
const listed = await request(app).get('/api/projects')
record('R03-webhook-roundtrip', { accepted: webhookResponse.status === 201, returnedVerbatim: JSON.stringify(listed.body).includes(syntheticWebhook), persistedVerbatim: store.getProject(webhookResponse.body.id)?.notification.target === syntheticWebhook }, { accepted: false, returnedVerbatim: false, persistedVerbatim: false })

const factory = { state: 'connected', fields: {}, sections: {}, nextCode: 'batch-test' }
const github = { state: 'connected', issues: [], pullRequests: [] }
const issue = { number: 1, title: 'Issue', labels: ['status:doing'], url: 'https://example.invalid/1' }
const pr = { number: 2, title: 'PR', url: 'https://example.invalid/2', reviewDecision: '', isDraft: false, baseRefName: 'integration/review-fixture', headRefName: 'feat/issue-1' }
record('R04-normal-doing-is-rework', calculateHumanActions({ ...github, issues: [issue] }, factory, p).metrics.rework, 0)
record('R05-approved-still-review', calculateHumanActions({ ...github, issues: [{ ...issue, labels: ['status:review'] }], pullRequests: [{ ...pr, reviewDecision: 'APPROVED' }] }, factory, p).metrics.review, 0)
record('R06-candidate-test-lost', calculateHumanActions(github, factory, p).actions.some(a => a.kind === 'testing'), true)
record('R07-draft-final-merge', calculateHumanActions({ ...github, pullRequests: [{ ...pr, isDraft: true, headRefName: 'candidate/review-fixture', baseRefName: 'main' }] }, factory, p).actions.some(a => a.kind === 'merge'), false)
record('R08-repeat-release-lost', calculateHumanActions({ ...github, latestRelease: { tagName: 'v1.0.0', url: 'https://example.invalid/release' } }, { ...factory, nextCode: 'tag' }, p).actions.some(a => a.kind === 'release'), true)

record('R09-invalid-timezone-accepted', projectInputSchema.safeParse({ ...input, dailyReport: { ...input.dailyReport, timezone: 'Not/A_Timezone' } }).success, false)
record('R10-relative-repo-accepted', projectInputSchema.safeParse({ ...input, localRepoPath: '.' }).success, false)
const status = { github, factory: { ...factory, summary: '等待候选测试' }, metrics: { todo: 0, review: 0, rework: 0, testing: 0 }, actions: [] }
record('R11-English-report-Chinese', /[\u4e00-\u9fff]/.test(generateDailyReport(p, status, 'en-US').markdown), false)
process.env.REVIEW_SYNTHETIC_SECRET = 'SYNTHETIC-REVIEW-NOT-A-REAL-SECRET'
process.env.REVIEW_SYNTHETIC_LEAK = '1'
const leaked = await readFactoryState({ ...p, mysql: { ...p.mysql, passwordSecretRef: 'REVIEW_SYNTHETIC_SECRET' } }, new EnvironmentSecretProvider())
record('R12-status-secret-redaction', leaked.message === process.env.REVIEW_SYNTHETIC_SECRET, false)
delete process.env.REVIEW_SYNTHETIC_SECRET
delete process.env.REVIEW_SYNTHETIC_LEAK
console.log(JSON.stringify(results, null, 2))
process.exitCode = results.every((row) => JSON.stringify(row.observed) === JSON.stringify(row.expected)) ? 0 : 1
store.close()
