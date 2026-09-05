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
  if (/^[\\/]/.test(path) || /^[A-Za-z]:/.test(path) || path.split(/[\\/]/).includes('..') || /[\r\n\0]/.test(path)) {
    throw new Error('unsafe_relative_path')
  }
}

export function buildActionCommand(project: ProjectConfig, action: ActionId): CommandSpec {
  if (!(action in ACTION_ALLOWLIST)) throw new Error('action_not_allowed')
  assertProjectRelative(project.factoryScriptPath)
  assertProjectRelative(project.prdPath)
  const script = project.factoryScriptPath.replaceAll('\\', '/')
  const base = { executable: 'bash' as const, cwd: project.localRepoPath }
  if (action === 'doctor') return { ...base, args: [script, 'doctor'], display: `factory doctor` }
  if (action === 'reviewCollect') {
    return { ...base, args: [script, 'review', 'collect', project.batchName], display: `factory review collect ${project.batchName}` }
  }
  return {
    ...base,
    args: [script, 'batch', 'start', project.batchName, '--prd', project.prdPath],
    display: `factory batch start ${project.batchName} --prd ${project.prdPath}`,
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
      env: { ...process.env, PYTHONUTF8: '1' },
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const limit = 200_000
    const append = (current: string, chunk: Buffer) => (current + chunk.toString('utf8')).slice(-limit)
    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk) })
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk) })
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      const values = secretRefs.map((ref) => secretProvider.resolve(ref)).filter((value): value is string => Boolean(value))
      resolvePromise({ exitCode: null, stdout: redactSecrets(stdout, values), stderr: redactSecrets(`${stderr}${error.message}`, values), timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const values = secretRefs.map((ref) => secretProvider.resolve(ref)).filter((value): value is string => Boolean(value))
      resolvePromise({ exitCode: code, stdout: redactSecrets(stdout, values), stderr: redactSecrets(stderr, values), timedOut })
    })
  })
}
