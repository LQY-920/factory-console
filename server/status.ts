import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  FactoryState,
  GithubIssue,
  GithubPullRequest,
  GithubState,
  GitState,
  HumanAction,
  MetricCounts,
  PipelineStep,
  ProjectConfig,
  ProjectStatus,
  ValidationResult,
} from '../shared/types.js'
import { runCommand, type CommandSpec } from './commands.js'
import type { SecretProvider } from './security.js'

const unavailable = (message: string) => ({ state: 'unavailable' as const, message })

function withDeadline<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(fallback), timeoutMs)
    timer.unref()
    promise.then((value) => { clearTimeout(timer); resolvePromise(value) }, () => { clearTimeout(timer); resolvePromise(fallback) })
  })
}

function spec(executable: 'git' | 'gh' | 'bash', args: string[], cwd: string): CommandSpec {
  return { executable, args, cwd, display: [executable, ...args].join(' ') }
}

function repoFromOrigin(origin?: string): string | undefined {
  if (!origin) return undefined
  const match = origin.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/i)
  return match ? `${match[1]}/${match[2]}` : undefined
}

export async function readGitState(project: ProjectConfig, secrets: SecretProvider): Promise<GitState> {
  if (!existsSync(project.localRepoPath)) return unavailable('repository_not_found')
  const commands = [
    ['rev-parse', '--is-inside-work-tree'],
    ['branch', '--show-current'],
    ['status', '--porcelain'],
    ['remote', 'get-url', 'origin'],
    ['log', '-1', '--format=%H%x1f%cI'],
    ['rev-list', '--count', 'HEAD..@{upstream}'],
  ]
  const results = await Promise.all(commands.map((args) => runCommand(spec('git', args, project.localRepoPath), secrets, [], 8_000)))
  if (results[0].exitCode !== 0) return unavailable(results[0].stderr.trim() || 'not_a_git_repository')
  const [hash, date] = results[4].stdout.trim().split('\u001f')
  return {
    state: 'connected',
    currentBranch: results[1].stdout.trim() || project.defaultBranch,
    dirty: Boolean(results[2].stdout.trim()),
    origin: results[3].exitCode === 0 ? results[3].stdout.trim() : undefined,
    latestCommit: hash || undefined,
    latestCommitAt: date || undefined,
    behind: results[5].exitCode === 0 ? Number.parseInt(results[5].stdout.trim(), 10) || 0 : null,
  }
}

function parseIssues(json: string): GithubIssue[] {
  const rows = JSON.parse(json) as Array<{ number: number; title: string; labels?: Array<{ name: string }>; url: string }>
  return rows.map((row) => ({ number: row.number, title: row.title, labels: row.labels?.map((label) => label.name) ?? [], url: row.url }))
}

function parsePullRequests(json: string): GithubPullRequest[] {
  const rows = JSON.parse(json) as GithubPullRequest[]
  return rows.map((row) => ({
    number: row.number,
    title: row.title,
    url: row.url,
    reviewDecision: row.reviewDecision || '',
    isDraft: Boolean(row.isDraft),
    baseRefName: row.baseRefName,
    headRefName: row.headRefName,
  }))
}

export async function readGithubState(project: ProjectConfig, git: GitState, secrets: SecretProvider): Promise<GithubState> {
  const repo = project.githubRepo || repoFromOrigin(git.origin)
  if (!repo) return { ...unavailable('github_repo_not_configured'), issues: [], pullRequests: [] }
  const auth = await runCommand(spec('gh', ['auth', 'status'], project.localRepoPath), secrets, [], 8_000)
  if (auth.exitCode !== 0) return { ...unavailable('github_cli_unavailable_or_logged_out'), repo, issues: [], pullRequests: [] }
  const [issuesResult, prsResult, releaseResult] = await Promise.all([
    runCommand(spec('gh', ['issue', 'list', '--repo', repo, '--state', 'open', '--limit', '100', '--json', 'number,title,labels,url'], project.localRepoPath), secrets, [], 15_000),
    runCommand(spec('gh', ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '100', '--json', 'number,title,url,reviewDecision,isDraft,baseRefName,headRefName'], project.localRepoPath), secrets, [], 15_000),
    runCommand(spec('gh', ['release', 'view', '--repo', repo, '--json', 'tagName,url,publishedAt'], project.localRepoPath), secrets, [], 15_000),
  ])
  if (issuesResult.exitCode !== 0 || prsResult.exitCode !== 0) {
    return { ...unavailable((issuesResult.stderr || prsResult.stderr).trim() || 'github_query_failed'), repo, issues: [], pullRequests: [] }
  }
  try {
    return {
      state: 'connected',
      repo,
      issues: parseIssues(issuesResult.stdout),
      pullRequests: parsePullRequests(prsResult.stdout),
      latestRelease: releaseResult.exitCode === 0 && releaseResult.stdout.trim() ? JSON.parse(releaseResult.stdout) : undefined,
    }
  } catch {
    return { ...unavailable('github_response_invalid'), repo, issues: [], pullRequests: [] }
  }
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
  for (const rawLine of nextOutput.split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (match) fields[match[1]] = match[2]
  }
  return { fields, sections, nextCode: fields.NEXT, summary: nextOutput.trim().split(/\r?\n/).find((line) => line && !/^[A-Z][A-Z0-9_]*=/.test(line)) }
}

export async function readFactoryState(project: ProjectConfig, secrets: SecretProvider): Promise<FactoryState> {
  const scriptPath = resolve(project.localRepoPath, project.factoryScriptPath)
  if (!existsSync(scriptPath)) return { ...unavailable('factory_script_not_found'), fields: {}, sections: {} }
  const scriptArgument = project.factoryScriptPath.replaceAll('\\', '/')
  const statusResult = await runCommand(spec('bash', [scriptArgument, 'status'], project.localRepoPath), secrets, [], 20_000)
  if (statusResult.exitCode !== 0) return { ...unavailable(statusResult.stderr.trim() || 'factory_status_failed'), fields: {}, sections: {} }
  const nextResult = await runCommand(spec('bash', [scriptArgument, 'next'], project.localRepoPath), secrets, [], 20_000)
  return {
    state: 'connected',
    message: nextResult.timedOut ? 'factory_next_timed_out' : nextResult.exitCode === 0 ? undefined : 'factory_next_unavailable',
    ...parseFactoryOutput(statusResult.stdout, nextResult.exitCode === 0 ? nextResult.stdout : ''),
  }
}

export function calculateHumanActions(github: GithubState, factory: FactoryState, project: ProjectConfig): { metrics: MetricCounts; actions: HumanAction[] } {
  const issues = github.issues
  const prs = github.pullRequests
  const todo = issues.filter((issue) => issue.labels.includes('status:todo')).length
  const reviewIssues = issues.filter((issue) => issue.labels.includes('status:review'))
  const awaitingReview = prs.filter((pr) => !pr.isDraft && !['APPROVED', 'CHANGES_REQUESTED'].includes(pr.reviewDecision))
  const changesRequested = prs.filter((pr) => pr.reviewDecision === 'CHANGES_REQUESTED')
  const doing = issues.filter((issue) => issue.labels.includes('status:doing'))
  const approved = prs.filter((pr) => pr.reviewDecision === 'APPROVED' && !pr.headRefName.startsWith('candidate/'))
  const candidate = prs.filter((pr) => pr.headRefName.startsWith('candidate/') && pr.baseRefName === project.defaultBranch)
  const review = Math.max(reviewIssues.length, awaitingReview.length)
  const rework = new Set([...changesRequested.map((pr) => `pr-${pr.number}`), ...doing.map((issue) => `issue-${issue.number}`)]).size
  const testing = approved.length
  const actions: HumanAction[] = []
  if (review > 0) actions.push({ id: 'review', kind: 'review', count: review, titleKey: 'actions.review', targetUrl: awaitingReview[0]?.url ?? reviewIssues[0]?.url, sourceId: awaitingReview[0]?.number ?? reviewIssues[0]?.number })
  if (testing > 0) actions.push({ id: 'testing', kind: 'testing', count: testing, titleKey: 'actions.testing', targetUrl: approved[0]?.url, sourceId: approved[0]?.number })
  if (rework > 0) actions.push({ id: 'rework', kind: 'rework', count: rework, titleKey: 'actions.rework', targetUrl: changesRequested[0]?.url, sourceId: changesRequested[0]?.number })
  if (candidate.length > 0) actions.push({ id: 'merge', kind: 'merge', count: candidate.length, titleKey: 'actions.merge', targetUrl: candidate[0].url, sourceId: candidate[0].number })
  if (github.state === 'connected' && github.latestRelease === undefined && factory.nextCode === 'tag') actions.push({ id: 'release', kind: 'release', count: 1, titleKey: 'actions.release' })
  if (github.latestRelease) actions.push({ id: 'deploy', kind: 'deploy', count: 1, titleKey: 'actions.deploy', targetUrl: github.latestRelease.url })
  return { metrics: { todo, review, testing, rework }, actions }
}

function buildPipeline(project: ProjectConfig, git: GitState, github: GithubState, factory: FactoryState, actions: HumanAction[]): PipelineStep[] {
  const hasRepo = git.state === 'connected'
  const hasIssues = github.state === 'connected' && github.issues.length > 0
  const current = git.currentBranch ?? ''
  const integration = `integration/${project.batchName}`
  const candidate = `candidate/${project.batchName}`
  const actionKinds = new Set(actions.map((action) => action.kind))
  return [
    { id: 'prd', labelKey: 'pipeline.prd', state: existsSync(resolve(project.localRepoPath, project.prdPath)) ? 'complete' : 'blocked' },
    { id: 'issues', labelKey: 'pipeline.issues', state: hasIssues ? 'complete' : github.state === 'unavailable' ? 'blocked' : 'pending' },
    { id: 'develop', labelKey: 'pipeline.develop', state: hasRepo ? 'complete' : 'blocked' },
    { id: 'collect', labelKey: 'pipeline.collect', state: current === integration ? 'active' : factory.nextCode === 'batch-review' ? 'complete' : 'pending', detail: integration },
    { id: 'humanReview', labelKey: 'pipeline.humanReview', state: actionKinds.has('review') || actionKinds.has('rework') ? 'human' : 'pending', count: actions.find((action) => action.kind === 'review')?.count },
    { id: 'candidateTest', labelKey: 'pipeline.candidateTest', state: current === candidate || actionKinds.has('testing') ? 'human' : 'pending', count: actions.find((action) => action.kind === 'testing')?.count, detail: candidate },
    { id: 'release', labelKey: 'pipeline.release', state: actionKinds.has('release') || actionKinds.has('merge') ? 'human' : 'pending', detail: project.defaultBranch },
    { id: 'deploy', labelKey: 'pipeline.deploy', state: actionKinds.has('deploy') ? 'human' : 'pending' },
    { id: 'knowledge', labelKey: 'pipeline.knowledge', state: 'pending' },
  ]
}

export async function getProjectStatus(project: ProjectConfig, secrets: SecretProvider): Promise<ProjectStatus> {
  const git = await readGitState(project, secrets)
  const [github, factory] = await Promise.all([
    withDeadline(readGithubState(project, git, secrets), 12_000, { ...unavailable('github_query_timed_out'), repo: project.githubRepo || repoFromOrigin(git.origin), issues: [], pullRequests: [] }),
    withDeadline(readFactoryState(project, secrets), 12_000, { ...unavailable('factory_status_timed_out'), fields: {}, sections: {} }),
  ])
  const { metrics, actions } = calculateHumanActions(github, factory, project)
  return {
    projectId: project.id,
    refreshedAt: new Date().toISOString(),
    git,
    github,
    factory,
    metrics,
    actions,
    pipeline: buildPipeline(project, git, github, factory, actions),
    secrets: {
      mysqlConfigured: secrets.isConfigured(project.mysql.passwordSecretRef),
      deployConfigured: secrets.isConfigured(project.deploy.credentialSecretRef),
      webhookConfigured: secrets.isConfigured(project.notification.webhookSecretRef),
    },
    demo: false,
  }
}

export async function validateProject(project: ProjectConfig, secrets: SecretProvider): Promise<ValidationResult> {
  const scriptPath = resolve(project.localRepoPath, project.factoryScriptPath)
  const prdPath = resolve(project.localRepoPath, project.prdPath)
  const git = await readGitState(project, secrets)
  return {
    valid: existsSync(project.localRepoPath) && git.state === 'connected',
    checks: [
      { key: 'localRepo', ok: existsSync(project.localRepoPath), message: existsSync(project.localRepoPath) ? 'repository_found' : 'repository_not_found' },
      { key: 'git', ok: git.state === 'connected', message: git.message ?? 'git_connected' },
      { key: 'factory', ok: existsSync(scriptPath), message: existsSync(scriptPath) ? 'factory_script_found' : 'factory_script_not_found' },
      { key: 'prd', ok: existsSync(prdPath), message: existsSync(prdPath) ? 'prd_found' : 'prd_not_found' },
      { key: 'mysqlSecret', ok: !project.mysql.passwordSecretRef || secrets.isConfigured(project.mysql.passwordSecretRef), message: secrets.isConfigured(project.mysql.passwordSecretRef) ? 'secret_configured' : 'secret_not_configured' },
      { key: 'deploySecret', ok: !project.deploy.credentialSecretRef || secrets.isConfigured(project.deploy.credentialSecretRef), message: secrets.isConfigured(project.deploy.credentialSecretRef) ? 'secret_configured' : 'secret_not_configured' },
    ],
  }
}
