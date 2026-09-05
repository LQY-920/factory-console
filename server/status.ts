import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FactoryState, GithubState, GitState, HumanAction, PipelineStep, ProjectConfig, ProjectStatus, ValidationResult } from '../shared/types.js'
import { runCommand, type CommandSpec } from './commands.js'
import { projectSecretRefs, type SecretProvider } from './security.js'
import { readGithub } from './github.js'
import { calculateHumanActions, readonlyNext } from './workflow.js'
export { calculateHumanActions } from './workflow.js'
export const readGithubState = readGithub

const unavailable = (message: string) => ({ state: 'unavailable' as const, message })
function spec(executable: 'git' | 'gh' | 'bash', args: string[], cwd: string): CommandSpec {
  return { executable, args, cwd, display: [executable, ...args].join(' ') }
}

export async function readGitState(project: ProjectConfig, secrets: SecretProvider): Promise<GitState> {
  if (!existsSync(project.localRepoPath)) return unavailable('repository_not_found')
  const commands = [
    ['rev-parse', '--is-inside-work-tree'], ['branch', '--show-current'], ['status', '--porcelain'],
    ['remote', 'get-url', 'origin'], ['log', '-1', '--format=%H%x1f%cI'], ['rev-list', '--count', 'HEAD..@{upstream}'],
  ]
  const results = await Promise.all(commands.map((args) => runCommand(spec('git', args, project.localRepoPath), secrets, projectSecretRefs(project), 8_000)))
  if (results[0].exitCode !== 0) return unavailable(results[0].stderr.trim() || 'not_a_git_repository')
  const [hash, date] = results[4].stdout.trim().split('\u001f')
  return { state: 'connected', currentBranch: results[1].stdout.trim() || project.defaultBranch, dirty: Boolean(results[2].stdout.trim()),
    origin: results[3].exitCode === 0 ? results[3].stdout.trim() : undefined, latestCommit: hash || undefined, latestCommitAt: date || undefined,
    behind: results[5].exitCode === 0 ? Number.parseInt(results[5].stdout.trim(), 10) || 0 : null }
}

export function parseFactoryOutput(statusOutput: string, nextOutput = ''): Pick<FactoryState, 'fields' | 'sections' | 'nextCode' | 'summary'> {
  const fields: Record<string, string> = {}
  const sections: Record<string, string[]> = {}
  let currentSection = ''
  for (const rawLine of statusOutput.split(/\r?\n/)) {
    const line = rawLine.trim()
    const section = line.match(/^\[([^\]]+)\]$/)
    if (section) { currentSection = section[1]; sections[currentSection] = []; continue }
    if (line && currentSection && /^#\d+\b/.test(line)) sections[currentSection].push(line)
  }
  for (const rawLine of (statusOutput + '\n' + nextOutput).split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (match) fields[match[1]] = match[2]
  }
  return { fields, sections, nextCode: fields.NEXT, summary: nextOutput.trim().split(/\r?\n/).find((line) => line && !/^[A-Z][A-Z0-9_]*=/.test(line)) }
}

export async function readFactoryState(project: ProjectConfig, secrets: SecretProvider): Promise<FactoryState> {
  const scriptPath = resolve(project.localRepoPath, project.factoryScriptPath)
  if (!existsSync(scriptPath)) return { ...unavailable('factory_script_not_found'), fields: {}, sections: {} }
  const scriptArgument = project.factoryScriptPath.replaceAll('\\', '/')
  const result = await runCommand(spec('bash', [scriptArgument, 'status'], project.localRepoPath), secrets, projectSecretRefs(project), 10_000)
  if (result.exitCode !== 0) return { ...unavailable(result.stderr.trim() || 'factory_status_failed'), fields: {}, sections: {} }
  // Upstream next invokes collect --apply: intentionally replaced by readonlyNext.
  return { state: 'connected', message: 'factory_next_readonly_adapter', ...parseFactoryOutput(result.stdout) }
}

function buildPipeline(project: ProjectConfig, git: GitState, github: GithubState, factory: FactoryState, actions: HumanAction[]): PipelineStep[] {
  const unknown = github.state !== 'connected'
  const active = github.issues.filter((i) => i.state !== 'CLOSED')
  const developing = active.some((i) => i.labels.some((l) => ['status:todo', 'status:doing'].includes(l)))
  const integration = `integration/${project.batchName}`
  const candidate = `candidate/${project.batchName}`
  const kinds = new Set(actions.map((a) => a.kind))
  const submitted = github.pullRequests.some((p) => p.mergedAt && p.baseRefName === integration)
  return [
    { id: 'prd', labelKey: 'pipeline.prd', state: existsSync(resolve(project.localRepoPath, project.prdPath)) ? 'complete' : 'blocked' },
    { id: 'issues', labelKey: 'pipeline.issues', state: unknown ? 'blocked' : github.issues.length ? 'complete' : 'pending' },
    { id: 'develop', labelKey: 'pipeline.develop', state: unknown || git.state !== 'connected' ? 'blocked' : developing ? 'active' : submitted || github.issues.some((i) => i.state === 'CLOSED') ? 'complete' : 'pending' },
    { id: 'collect', labelKey: 'pipeline.collect', state: unknown ? 'blocked' : submitted ? 'complete' : git.currentBranch === integration ? 'active' : 'pending', detail: integration },
    { id: 'humanReview', labelKey: 'pipeline.humanReview', state: unknown ? 'blocked' : kinds.has('review') || kinds.has('rework') || kinds.has('promote') ? 'human' : submitted ? 'complete' : 'pending', count: actions.filter((a) => ['review', 'rework', 'promote'].includes(a.kind)).reduce((sum, a) => sum + a.count, 0) },
    { id: 'candidateTest', labelKey: 'pipeline.candidateTest', state: unknown || github.candidate?.state === 'unavailable' ? 'blocked' : kinds.has('testing') ? 'human' : github.candidate?.state === 'connected' && github.candidate.total > 0 && github.candidate.pending === 0 ? 'complete' : 'pending', count: actions.find((a) => a.kind === 'testing')?.count, detail: candidate },
    { id: 'release', labelKey: 'pipeline.release', state: unknown ? 'blocked' : kinds.has('release') || kinds.has('merge') ? 'human' : github.latestRelease ? 'complete' : 'pending', detail: project.defaultBranch },
    { id: 'deploy', labelKey: 'pipeline.deploy', state: unknown ? 'blocked' : kinds.has('deploy') ? 'human' : github.latestRelease?.deployed ? 'complete' : 'pending' },
    { id: 'knowledge', labelKey: 'pipeline.knowledge', state: factory.nextCode === 'done' ? 'human' : 'pending' },
  ]
}

export async function getProjectStatus(project: ProjectConfig, secrets: SecretProvider): Promise<ProjectStatus> {
  const git = await readGitState(project, secrets)
  const [github, factory] = await Promise.all([readGithub(project, git, secrets), readFactoryState(project, secrets)])
  const { metrics, actions } = calculateHumanActions(github, factory, project)
  const next = readonlyNext(github, actions, git.dirty)
  factory.nextCode = next
  factory.fields = { ...factory.fields, NEXT: next, BATCH: project.batchName, BRANCH: git.currentBranch ?? project.defaultBranch, SOURCE: 'console-readonly' }
  factory.summary = undefined
  return { projectId: project.id, refreshedAt: new Date().toISOString(), git, github, factory, metrics, actions,
    pipeline: buildPipeline(project, git, github, factory, actions),
    secrets: { mysqlConfigured: secrets.isConfigured(project.mysql.passwordSecretRef), deployConfigured: secrets.isConfigured(project.deploy.credentialSecretRef), webhookConfigured: secrets.isConfigured(project.notification.target) },
    demo: false }
}

export async function validateProject(project: ProjectConfig, secrets: SecretProvider): Promise<ValidationResult> {
  const git = await readGitState(project, secrets)
  const auth = await runCommand(spec('gh', ['auth', 'status'], project.localRepoPath), secrets, projectSecretRefs(project), 8_000)
  const checks = [
    { key: 'localRepo', ok: existsSync(project.localRepoPath), message: existsSync(project.localRepoPath) ? 'repository_found' : 'repository_not_found' },
    { key: 'git', ok: git.state === 'connected', message: git.state === 'connected' ? 'git_connected' : 'not_a_git_repository' },
    { key: 'github', ok: auth.exitCode === 0, message: auth.exitCode === 0 ? 'github_authenticated' : 'github_query_failed' },
    ...(['factory', 'prd'] as const).map((key) => ({ key, ok: existsSync(resolve(project.localRepoPath, key === 'factory' ? project.factoryScriptPath : project.prdPath)), message: existsSync(resolve(project.localRepoPath, key === 'factory' ? project.factoryScriptPath : project.prdPath)) ? 'file_found' : 'file_not_found' })),
    ...(['mysql', 'deploy'] as const).map((key) => { const ref = key === 'mysql' ? project.mysql.passwordSecretRef : project.deploy.credentialSecretRef; return { key: `${key}Secret`, ok: !ref || secrets.isConfigured(ref), message: !ref ? 'secret_not_configured' : secrets.isConfigured(ref) ? 'secret_configured' : 'secret_missing' } }),
  ]
  return { valid: checks.every((c) => c.ok), checks }
}
