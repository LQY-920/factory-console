import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DailyReportPreview, ProjectConfig, ProjectInput, RunRecord } from '../shared/types.js'
import { redactSecrets } from './security.js'

export interface Store {
  listProjects(): ProjectConfig[]
  getProject(id: string): ProjectConfig | undefined
  createProject(input: ProjectInput): ProjectConfig
  updateProject(id: string, input: ProjectInput): ProjectConfig | undefined
  deleteProject(id: string): boolean
  createRun(projectId: string, action: string, command: string): RunRecord
  finishRun(id: string, exitCode: number | null, output: string): RunRecord | undefined
  listRuns(projectId?: string, status?: string): RunRecord[]
  audit(projectId: string, action: string, output?: string): void
  saveReport(preview: DailyReportPreview, scheduledDate?: string): DailyReportPreview
  listReports(projectId: string): DailyReportPreview[]
  hasScheduledReport(projectId: string, date: string): boolean
  setReportDelivery(id: string, sent: boolean, error?: string): void
  close(): void
}

export function createStore(databasePath = process.env.FACTORY_CONSOLE_DB ?? resolve('.data', 'factory-console.sqlite')): Store {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })
  const db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('secure_delete = ON')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      action TEXT NOT NULL,
      command TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      exit_code INTEGER,
      status TEXT NOT NULL,
      output TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_runs_project_started ON runs(project_id, started_at DESC);
    CREATE TABLE IF NOT EXISTS audit_runs AS SELECT * FROM runs WHERE 0;
    CREATE TABLE IF NOT EXISTS daily_reports (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, generated_at TEXT NOT NULL, locale TEXT NOT NULL,
      markdown TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, delivery_error TEXT NOT NULL DEFAULT '',
      scheduled_date TEXT, UNIQUE(project_id, scheduled_date)
    );
  `)

  // Remove insecure legacy webhook URL fields without ever returning their values.
  let migrated = false
  for (const row of db.prepare('SELECT id, config_json FROM projects').all() as Array<{id: string; config_json: string}>) {
    const config = JSON.parse(row.config_json) as ProjectInput
    if (config.notification?.target && !/^[A-Z][A-Z0-9_]{1,127}$/.test(config.notification.target)) {
      const legacy = config.notification.target
      config.notification.target = ''
      db.prepare('UPDATE projects SET config_json = ? WHERE id = ?').run(JSON.stringify(config), row.id)
      for (const table of ['runs', 'audit_runs']) {
        for (const run of db.prepare(`SELECT id, output FROM ${table}`).all() as Array<{id: string; output: string}>) {
          db.prepare(`UPDATE ${table} SET output = ? WHERE id = ?`).run(redactSecrets(run.output, [legacy]), run.id)
        }
      }
      migrated = true
    }
  }
  if (migrated && databasePath !== ':memory:') { db.pragma('wal_checkpoint(TRUNCATE)'); db.exec('VACUUM'); db.pragma('wal_checkpoint(TRUNCATE)') }

  const decodeProject = (row: any): ProjectConfig => ({
    ...(JSON.parse(row.config_json) as ProjectInput),
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
  const decodeRun = (row: any): RunRecord => ({
    id: row.id,
    projectId: row.project_id,
    action: row.action,
    command: row.command,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    exitCode: row.exit_code,
    status: row.status,
    output: row.output,
  })

  return {
    listProjects() {
      return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all().map(decodeProject)
    },
    getProject(id) {
      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
      return row ? decodeProject(row) : undefined
    },
    createProject(input) {
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare('INSERT INTO projects (id, display_name, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, input.displayName, JSON.stringify(input), now, now)
      return { ...input, id, createdAt: now, updatedAt: now }
    },
    updateProject(id, input) {
      const existing = this.getProject(id)
      if (!existing) return undefined
      const now = new Date().toISOString()
      db.prepare('UPDATE projects SET display_name = ?, config_json = ?, updated_at = ? WHERE id = ?')
        .run(input.displayName, JSON.stringify(input), now, id)
      return { ...input, id, createdAt: existing.createdAt, updatedAt: now }
    },
    deleteProject(id) {
      return db.transaction(() => {
        db.prepare('DELETE FROM daily_reports WHERE project_id = ?').run(id)
        return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0
      })()
    },
    createRun(projectId, action, command) {
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, projectId, action, command, now, now, null, 'running', '')
      return { id, projectId, action, command, startedAt: now, finishedAt: now, exitCode: null, status: 'running', output: '' }
    },
    finishRun(id, exitCode, output) {
      const now = new Date().toISOString()
      const status = exitCode === 0 ? 'success' : 'failed'
      db.prepare('UPDATE runs SET finished_at = ?, exit_code = ?, status = ?, output = ? WHERE id = ?')
        .run(now, exitCode, status, output, id)
      const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id)
      return row ? decodeRun(row) : undefined
    },
    listRuns(projectId, status) {
      const clauses: string[] = []
      const params: string[] = []
      if (projectId) { clauses.push('project_id = ?'); params.push(projectId) }
      if (status) { clauses.push('status = ?'); params.push(status) }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      return db.prepare(`SELECT * FROM (SELECT * FROM runs UNION ALL SELECT * FROM audit_runs) ${where} ORDER BY started_at DESC LIMIT 200`).all(...params).map(decodeRun)
    },
    audit(projectId, action, output = '') {
      const now = new Date().toISOString()
      db.prepare('INSERT INTO audit_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), projectId, action, action, now, now, 0, 'success', redactSecrets(output))
    },
    saveReport(preview, scheduledDate) {
      const id = randomUUID()
      db.prepare('INSERT INTO daily_reports (id, project_id, generated_at, locale, markdown, sent, scheduled_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, preview.projectId, preview.generatedAt, preview.locale ?? 'zh-CN', redactSecrets(preview.markdown), preview.sent ? 1 : 0, scheduledDate ?? null)
      return { ...preview, id }
    },
    listReports(projectId) {
      return (db.prepare('SELECT * FROM daily_reports WHERE project_id = ? ORDER BY generated_at DESC LIMIT 100').all(projectId) as any[]).map((row) => ({ id: row.id, projectId: row.project_id, generatedAt: row.generated_at, locale: row.locale, markdown: row.markdown, sent: Boolean(row.sent), notificationConfigured: false, deliveryError: row.delivery_error || undefined }))
    },
    hasScheduledReport(projectId, date) { return Boolean(db.prepare('SELECT id FROM daily_reports WHERE project_id = ? AND scheduled_date = ?').get(projectId, date)) },
    setReportDelivery(id, sent, error = '') { db.prepare('UPDATE daily_reports SET sent = ?, delivery_error = ? WHERE id = ?').run(sent ? 1 : 0, error, id) },
    close() { db.close() },
  }
}
