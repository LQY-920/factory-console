import process from 'node:process'
import console from 'node:console'
import { resolve } from 'node:path'
import { createStore } from '../../dist/server/server/db.js'
import { createApp } from '../../dist/server/server/app.js'
import { input } from './fixtures.mjs'
process.env.NODE_ENV = 'test'
process.env.FACTORY_CONSOLE_TEST_GH_SCRIPT = resolve('.codex/review/fake-gh.mjs')
const store = createStore(':memory:')
store.createProject(input)
store.createProject({ ...input, displayName: 'REVIEW-FIXTURE-B', batchName: 'review-b', dailyReport: { enabled: false, time: '17:45', timezone: 'UTC' } })
const { app } = createApp({ store })
app.listen(8788, '127.0.0.1', () => console.log('Review-only fixture server http://127.0.0.1:8788 (in-memory DB; no scheduler; fake CLIs)'))
