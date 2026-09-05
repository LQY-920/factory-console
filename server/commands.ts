import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ActionId, ProjectConfig } from '../shared/types.js'
import { redactSecrets, type SecretProvider } from './security.js'

export interface CommandSpec {
  executable: 'git' | 'gh' | 'bash'
  args: string[]
  cwd: string
  display: string
}

export interface CommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export const ACTION_ALLOWLIST: Readonly<Record<ActionId, { mutating: boolean }>> = Object.freeze({
  doctor: { mutating: false },
  reviewCollect: { mutating: true },
  batchStart: { mutating: true },
})

export function isAllowedAction(action: string): action is ActionId {
  return Object.hasOwn(ACTION_ALLOWLIST, action)
}

export function resolveExecutable(executable: CommandSpec['executable']): string {
  if (executable !== 'bash' || process.platform !== 'win32') return executable
  const configured = process.env.FACTORY_CONSOLE_BASH_PATH
  if (configured && basename(configured).toLowerCase() === 'bash.exe' && existsSync(configured)) return configured
  const candidates = (process.env.PATH ?? '').split(';').flatMap((segment) => {
    const normalized = segment.replaceAll('/', '\\').replace(/\\$/, '')
    if (/\\git\\bin$/i.test(normalized)) return [join(normalized, 'bash.exe')]
    if (/\\git\\cmd$/i.test(normalized)) return [join(normalized, '..', 'bin', 'bash.exe')]
    return []
  })
  return candidates.find(existsSync) ?? executable
}

function assertProjectRelative(path: string): void {
  if (/^[-\\/]/.test(path) || /^[A-Za-z]:/.test(path) || path.split(/[\\/]/).includes('..') || /[\r\n\0]/.test(path)) {
    throw new Error('unsafe_relative_path')
  }
}

export function buildActionCommand(project: ProjectConfig, action: ActionId): CommandSpec {
  if (!isAllowedAction(action)) throw new Error('action_not_allowed')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(project.batchName)) throw new Error('unsafe_batch')
  assertProjectRelative(project.factoryScriptPath)
  assertProjectRelative(project.prdPath)
  const script = project.factoryScriptPath.replaceAll('\\', '/')
  const base = { executable: 'bash' as const, cwd: project.localRepoPath }
  if (action === 'doctor') return { ...base, args: [script, 'doctor'], display: `factory doctor` }
  if (action === 'reviewCollect') {
    return { ...base, args: [script, 'review', 'collect', project.batchName], display: `bash ${JSON.stringify(script)} review collect ${project.batchName}` }
  }
  return {
    ...base,
    args: [script, 'batch', 'start', project.batchName, '--prd', project.prdPath],
    display: `bash ${JSON.stringify(script)} batch start ${project.batchName} --prd ${JSON.stringify(project.prdPath)}`,
  }
}

export function runCommand(
  spec: CommandSpec,
  secretProvider: SecretProvider,
  secretRefs: Array<string | undefined> = [],
  timeoutMs = 20_000,
): Promise<CommandResult> {
  if (!['git', 'gh', 'bash'].includes(spec.executable)) return Promise.reject(new Error('executable_not_allowed'))
  return new Promise((resolvePromise) => {
    const mockGh = process.env.NODE_ENV === 'test' && spec.executable === 'gh' ? process.env.FACTORY_CONSOLE_TEST_GH_SCRIPT : undefined
    const executable = mockGh && existsSync(mockGh) ? process.execPath : resolveExecutable(spec.executable)
    const args = mockGh && existsSync(mockGh) ? [mockGh, ...spec.args] : spec.args
    const child = spawn(executable, args, {
      cwd: spec.cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' },
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const finish = (exitCode: number | null, error = '') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const values = secretRefs.map((ref) => secretProvider.resolve(ref)).filter((value): value is string => Boolean(value))
      resolvePromise({ exitCode, stdout: redactSecrets(stdout, values), stderr: redactSecrets(stderr + error, values), timedOut })
    }
    const limit = 200_000
    const append = (current: string, chunk: Buffer) => (current + chunk.toString('utf8')).slice(-limit)
    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk) })
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk) })
    const timer = setTimeout(() => {
      timedOut = true
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' })
        killer.on('error', () => child.kill())
      } else child.kill('SIGKILL')
      finish(124, '\ncommand_timed_out')
    }, timeoutMs)
    child.on('error', (error) => {
      finish(null, error.message)
    })
    child.on('close', (code) => {
      finish(code)
    })
  })
}
