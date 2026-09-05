import type { CandidateEvidence, GithubIssue, GithubPullRequest, GithubState, GitState, ProjectConfig } from '../shared/types.js'
import { runCommand } from './commands.js'
import { projectSecretRefs, type SecretProvider } from './security.js'

interface RestIssue { number: number; title: string; body?: string; state: string; html_url: string; closed_at?: string; pull_request?: unknown; milestone?: { title: string }; labels: Array<{ name: string }> }
interface RestPr { number: number; title: string; body: string; html_url: string; state: string; draft: boolean; merged_at?: string; updated_at: string; head: { ref: string }; base: { ref: string }; labels: Array<{ name: string }> }
interface DecisionEvent { body: string; author_association: string; updated_at?: string; created_at?: string; submitted_at?: string; state?: string }

export function parseTestEvidence(markdown: string): { total: number; pending: number } {
  const cases = markdown.split(/^###\s+TC-/m).slice(1)
  let total = 0; let pending = 0
  for (const block of cases) {
    if (!/^-\s*(?:优先级|Priority)\s*:\s*P[01](?:\s|\||$)/mi.test(block)) continue
    total++
    const result = block.match(/^-\s*(?:执行结果|Result)\s*:\s*(.*)$/mi)?.[1] ?? ''
    if (!/^(?:✅(?:\s*(?:通过|PASS(?:ED)?))?|PASS(?:ED)?|通过)(?:\s|$|[（(])/i.test(result.trim()) || /未执行|不通过|失败|FAIL|BLOCK|❌|⛔/i.test(result)) pending++
  }
  return { total, pending }
}

export function latestDecision(events: DecisionEvent[], labels: string[]): Pick<GithubPullRequest, 'reviewDecision' | 'feedback' | 'decisionSource'> {
  const decisions = events.filter((event) => ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(event.author_association)).flatMap((event) => {
    const first = (event.body ?? '').trim().split(/\r?\n/)[0].trim().replace(/[。.!！]+$/, '').toLowerCase()
    const state = event.state === 'DISMISSED' ? 'REVIEW_REQUIRED' : event.state === 'APPROVED' || event.state === 'CHANGES_REQUESTED' ? event.state
      : ['/factory approve', '可以进入测试', '可以合并进入测试', '批准进入测试'].includes(first) ? 'APPROVED'
        : ['/factory request-changes', '退回修改'].includes(first) ? 'CHANGES_REQUESTED' : ''
    return state ? [{ state, body: event.body, at: event.submitted_at ?? event.updated_at ?? event.created_at ?? '', source: event.state ? 'review' : 'comment' }] : []
  }).sort((a, b) => b.at.localeCompare(a.at))
  const latest = decisions[0]
  return latest ? { reviewDecision: latest.state, feedback: latest.body, decisionSource: latest.source }
    : { reviewDecision: labels.includes('review:changes-requested') ? 'CHANGES_REQUESTED' : labels.includes('review:approved') ? 'APPROVED' : '', decisionSource: 'label' }
}

export function issueFromPr(body: string, branch: string): number | undefined {
  const match = body.match(/(?:refs?|resolves?|closes?|fixes?)\s+#(\d+)/i) ?? branch.match(/(?:issue-|review-issue-)(\d+)/)
  return match ? Number(match[1]) : undefined
}

export function dependencies(body: string): number[] {
  const section = body.match(/^##\s+(?:依赖|Dependencies)\s*\r?\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/mi)?.[1] ?? ''
  return [...new Set([...section.matchAll(/#(\d+)/g)].map((match) => Number(match[1]))) ]
}

export async function readGithub(project: ProjectConfig, git: GitState, secrets: SecretProvider): Promise<GithubState> {
  const originMatch = git.origin?.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/i)
  const repo = project.githubRepo || (originMatch ? `${originMatch[1]}/${originMatch[2]}` : undefined)
  const unavailable = (message: string): GithubState => ({ state: 'unavailable', message, repo, issues: [], pullRequests: [] })
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return unavailable('github_repo_not_configured')
  const base = `repos/${repo}`
  const api = async <T>(endpoint: string, paginate = false): Promise<T> => {
    const args = ['api', '--method', 'GET', endpoint, ...(paginate ? ['--paginate', '--slurp'] : [])]
    let result = await runCommand({ executable: 'gh', args, cwd: project.localRepoPath, display: `gh api GET ${endpoint}` }, secrets, projectSecretRefs(project), 12_000)
    if (result.exitCode !== 0 && !result.stderr.includes('404')) {
      result = await runCommand({ executable: 'gh', args, cwd: project.localRepoPath, display: `gh api GET ${endpoint}` }, secrets, projectSecretRefs(project), 12_000)
    }
    if (result.exitCode !== 0) throw new Error(result.stderr.includes('404') ? 'github_not_found' : result.timedOut ? 'github_query_timed_out' : 'github_query_failed')
    const value = JSON.parse(result.stdout)
    return (paginate ? value.flat() : value) as T
  }
  try {
    const [rawIssues, rawPrs, milestones, rawReleases, rawTags] = await Promise.all([
      api<RestIssue[]>(`${base}/issues?state=all&per_page=100`, true),
      api<RestPr[]>(`${base}/pulls?state=all&per_page=100`, true),
      api<Array<{title: string; state: string; html_url: string}>>(`${base}/milestones?state=all&per_page=100`, true),
      api<Array<{tag_name: string; html_url: string; body: string; published_at: string; draft: boolean}>>(`${base}/releases?per_page=100`, true),
      api<Array<{name: string}>>(`${base}/tags?per_page=100`, true),
    ])
    const hasBatch = milestones.some((m) => m.title === project.batchName)
    const issues: GithubIssue[] = rawIssues.filter((row) => !row.pull_request && (hasBatch ? row.milestone?.title === project.batchName : !row.milestone)).map((row) => ({
      number: row.number, title: row.title, body: row.body ?? '', state: row.state.toUpperCase(), closedAt: row.closed_at,
      labels: row.labels.map((l) => l.name), url: row.html_url, milestone: row.milestone?.title, dependencies: dependencies(row.body ?? ''),
    }))
    const relevant = rawPrs.filter((pr) => pr.base.ref === `integration/${project.batchName}` || pr.head.ref === `candidate/${project.batchName}` || (!hasBatch && pr.base.ref === project.defaultBranch && !pr.head.ref.startsWith('candidate/')))
    const pullRequests: GithubPullRequest[] = []
    // Bounded concurrency; comments and native reviews include merged submissions.
    for (let offset = 0; offset < relevant.length; offset += 4) {
      pullRequests.push(...await Promise.all(relevant.slice(offset, offset + 4).map(async (pr) => {
        const [comments, reviews] = await Promise.all([
          api<DecisionEvent[]>(`${base}/issues/${pr.number}/comments?per_page=100`, true),
          api<DecisionEvent[]>(`${base}/pulls/${pr.number}/reviews?per_page=100`, true),
        ])
        const labels = pr.labels.map((l) => l.name)
        return { number: pr.number, title: pr.title, body: pr.body ?? '', url: pr.html_url, state: pr.merged_at ? 'MERGED' : pr.state.toUpperCase(), isDraft: pr.draft, mergedAt: pr.merged_at, updatedAt: pr.updated_at,
          headRefName: pr.head.ref, baseRefName: pr.base.ref, labels, issueNumber: issueFromPr(pr.body ?? '', pr.head.ref), promoted: labels.includes('review:promoted'), ...latestDecision([...comments, ...reviews], labels) }
      })))
    }
    const candidateBranch = `candidate/${project.batchName}`
    let candidate: CandidateEvidence = { state: 'notConfigured', total: 0, pending: 0, files: [] }
    try {
      const tree = await api<{tree: Array<{path: string; type: string}>; truncated: boolean}>(`${base}/git/trees/${encodeURIComponent(candidateBranch)}?recursive=1`)
      if (tree.truncated) throw new Error('github_tree_truncated')
      const paths = tree.tree.filter((entry) => entry.type === 'blob' && entry.path.endsWith(`-${project.batchName}-testcases.md`))
      const files = []
      let total = 0; let pending = 0
      for (const { path } of paths) {
        const content = await api<{content: string; encoding: string}>(`${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(candidateBranch)}`)
        if (content.encoding !== 'base64') throw new Error('test_evidence_unavailable')
        const parsed = parseTestEvidence(Buffer.from(content.content, 'base64').toString('utf8'))
        total += parsed.total; pending += parsed.pending
        files.push({ path, pending: parsed.pending, url: `https://github.com/${repo}/blob/${encodeURIComponent(candidateBranch)}/${path}` })
      }
      candidate = { state: 'connected', total, pending: total ? pending : 1, files, message: total ? undefined : 'candidate_test_evidence_missing' }
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'github_not_found') candidate = { ...candidate, state: 'unavailable', message: 'candidate_test_evidence_unavailable' }
    }
    const releases = rawReleases.filter((r) => !r.draft).map((r) => ({ tagName: r.tag_name, url: r.html_url, publishedAt: r.published_at, body: r.body, deployed: /(?:^|\n)(?:✅\s*)?已上线\b|(?:^|\n)\s*(?:✅\s*)?已上线\s|<!--\s*factory:deployed\s*-->/m.test(r.body ?? '') })).sort((a,b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    let unpublishedCommits: number | null = null
    try {
      const tag = releases[0]?.tagName ?? rawTags[0]?.name
      unpublishedCommits = tag ? (await api<{ahead_by: number}>(`${base}/compare/${encodeURIComponent(tag)}...${encodeURIComponent(project.defaultBranch)}`)).ahead_by
        : (await api<unknown[]>(`${base}/commits?sha=${encodeURIComponent(project.defaultBranch)}&per_page=100`, true)).length
    } catch { /* Unknown is never promoted into a release-ready claim. */ }
    return { state: 'connected', repo, issues, issueStates: Object.fromEntries(rawIssues.filter((i) => !i.pull_request).map((i) => [i.number, i.state.toUpperCase()])), pullRequests, releases, latestRelease: releases[0], tags: rawTags.map((t) => t.name), unpublishedCommits, candidate,
      milestones: milestones.map((m) => ({ title: m.title, state: m.state, url: m.html_url })),
      history: [...issues.filter((i) => i.state === 'CLOSED' && i.closedAt).map((i) => ({kind: 'issue' as const, number: i.number, title: i.title, url: i.url, completedAt: i.closedAt!})), ...pullRequests.filter((p) => p.mergedAt).map((p) => ({kind: 'pr' as const, number: p.number, title: p.title, url: p.url, completedAt: p.mergedAt!}))] }
  } catch (error) { return unavailable(error instanceof Error ? error.message : 'github_query_failed') }
}
