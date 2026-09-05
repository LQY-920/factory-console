import { createApp } from './app.js'
import { createStore } from './db.js'
import { EnvironmentSecretProvider } from './security.js'
import { startDailyReportScheduler } from './scheduler.js'

const port = Number(process.env.FACTORY_CONSOLE_PORT ?? 8787)
const host = process.env.FACTORY_CONSOLE_HOST ?? '127.0.0.1'
const store = createStore()
const secrets = new EnvironmentSecretProvider()
const { app } = createApp({ store, secrets })
startDailyReportScheduler(store, secrets)

app.listen(port, host, () => {
  process.stdout.write(`Factory Console API listening on http://${host}:${port}\n`)
})
