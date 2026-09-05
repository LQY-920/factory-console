import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ProjectConfig, ProjectInput, RunRecord } from '../shared/types.js'

export interface Store {
  listProjects(): ProjectConfig[]
  getProject(id: string): ProjectConfig | undefined
  createProject(input: ProjectInput): ProjectConfig
  updateProject(id: string, input: ProjectInput): ProjectConfig | undefined
  deleteProject(id: string): boolean
  createRun(projectId: string, action: string, command: string): RunRecord
  finishRun(id: string, exitCode: number | null, output: string): RunRecord | undefined
  listRuns(projectId?: string, status?: string): RunRecord[]
  close(): void
}

export function createStore(databasePath = process.env.FACTORY_CONSOLE_DB ?? resolve('.data', 'factory-console.sqlite')): Store {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })
  const db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
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
  `)

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
      return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0
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
      return db.prepare(`SELECT * FROM runs ${where} ORDER BY started_at DESC LIMIT 200`).all(...params).map(decodeRun)
    },
    close() { db.close() },
  }
}

