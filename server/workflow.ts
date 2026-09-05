import type { FactoryState, GithubPullRequest, GithubState, HumanAction, HumanActionKind, MetricCounts, ProjectConfig } from '../shared/types.js'
import { issueFromPr } from './github.js'

type Item = NonNullable<HumanAction['items']>[number]
export function calculateHumanActions(github: GithubState, factory: FactoryState, project: ProjectConfig): { metrics: MetricCounts; actions: HumanAction[] } {
  if (github.state !== 'connected') return { metrics: { todo: null, review: null, testing: null, rework: null }, actions: [] }
  const active = github.issues.filter((i) => i.state !== 'CLOSED')
  const groups = new Map<HumanActionKind, Item[]>()
  const add = (kind: HumanActionKind, item: Item) => groups.set(kind, [...(groups.get(kind) ?? []), item])
  const latest = new Map<string, GithubPullRequest>()
  const submissions = github.pullRequests.filter((p) => !p.headRefName.startsWith('candidate/') && p.state !== 'CLOSED' && !p.isDraft && (p.baseRefName === `integration/${project.batchName}` || p.baseRefName === project.defaultBranch)).map((p) => ({ ...p, issueNumber: p.issueNumber ?? issueFromPr(p.body ?? '', p.headRefName) }))
  for (const pr of [...submissions].sort((a, b) => (a.mergedAt ?? a.updatedAt ?? String(a.number).padStart(10, '0')).localeCompare(b.mergedAt ?? b.updatedAt ?? String(b.number).padStart(10, '0')))) {
    latest.set(pr.issueNumber ? `issue-${pr.issueNumber}` : `pr-${pr.number}`, pr)
  }
  const handled = new Set<number>()
  for (const pr of latest.values()) {
    const issue = github.issues.find((i) => i.number === pr.issueNumber)
    if (issue?.state === 'CLOSED') continue
    if (issue) handled.add(issue.number)
    const blockedBy = issue?.dependencies?.filter((id) => {
      const dep = github.issues.find((i) => i.number === id)
      const depPr = latest.get(`issue-${id}`)
      return (dep?.state ?? github.issueStates?.[id]) !== 'CLOSED' && !(depPr?.reviewDecision === 'APPROVED' && (depPr.promoted || depPr.labels?.includes('review:promoted')))
    }) ?? []
    const item: Item = { title: pr.title, url: pr.url, sourceId: pr.number, feedback: pr.feedback, blockedBy }
    const decision = pr.reviewDecision || (pr.decisionSource && pr.decisionSource !== 'label' ? '' : pr.labels?.includes('review:changes-requested') ? 'CHANGES_REQUESTED' : pr.labels?.includes('review:approved') ? 'APPROVED' : '')
    if (decision === 'CHANGES_REQUESTED') add('rework', item)
    else if (decision === 'APPROVED') {
      if (pr.baseRefName === project.defaultBranch && pr.state !== 'MERGED') add('merge', item)
      else if (!pr.promoted && !pr.labels?.includes('review:promoted')) add('promote', item)
    } else add('review', item)
  }
  for (const issue of active.filter((i) => !handled.has(i.number))) {
    const item = { title: issue.title, url: issue.url, sourceId: issue.number }
    if (issue.labels.includes('review:changes-requested') || issue.labels.includes('status:rework')) add('rework', item)
    else if (issue.labels.includes('status:review')) add('review', item)
  }
  const candidate = github.candidate
  if (candidate?.state === 'connected' && candidate.pending > 0) {
    for (const file of candidate.files.filter((f) => f.pending)) add('testing', { title: file.path, url: file.url })
    if (!groups.has('testing')) add('testing', { title: `candidate/${project.batchName}`, url: `https://github.com/${github.repo}/tree/${encodeURIComponent(`candidate/${project.batchName}`)}` })
  } else if (!candidate && ['batch-test', 'test'].includes(factory.nextCode ?? '')) add('testing', { title: `candidate/${project.batchName}`, url: `https://github.com/${github.repo}/tree/${encodeURIComponent(`candidate/${project.batchName}`)}` })
  for (const pr of github.pullRequests.filter((p) => p.headRefName === `candidate/${project.batchName}` && p.baseRefName === project.defaultBranch && !p.isDraft && p.state !== 'MERGED' && p.state !== 'CLOSED')) {
    add('merge', { title: pr.title, url: pr.url, sourceId: pr.number })
  }
  if ((github.unpublishedCommits ?? 0) > 0 || (github.unpublishedCommits === undefined && factory.nextCode === 'tag')) add('release', { title: project.defaultBranch, url: `https://github.com/${github.repo}/releases/new` })
  for (const release of github.releases ?? (github.latestRelease ? [github.latestRelease] : [])) {
    if (!release.deployed && !/(?:^|\n)\s*(?:✅\s*)?已上线(?:\s|$)|<!--\s*factory:deployed\s*-->/m.test(release.body ?? '')) {
      const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'"
      const command = project.deploy?.projectPath && !/[\r\n\0]/.test(project.deploy.projectPath) && !/[\r\n\0]/.test(release.tagName)
        ? `cd -- ${quote(project.deploy.projectPath)}\ngit fetch origin --tags\ngit checkout --detach ${quote(release.tagName)}\n# README: build / start / health check`
        : undefined
      add('deploy', { title: release.tagName, url: release.url, command })
    }
  }
  const actions: HumanAction[] = [...groups].map(([kind, items]) => ({ id: kind, kind, count: items.length, titleKey: `actions.${kind}`, targetUrl: items[0]?.url, sourceId: items[0]?.sourceId, items }))
  return { metrics: { todo: active.filter((i) => i.labels.includes('status:todo')).length, review: groups.get('review')?.length ?? 0, rework: groups.get('rework')?.length ?? 0,
    testing: candidate?.state === 'unavailable' ? null : candidate?.state === 'connected' ? candidate.pending : groups.get('testing')?.length ?? 0 }, actions }
}

export function readonlyNext(github: GithubState, actions: HumanAction[], dirty: boolean | undefined): string {
  if (github.state !== 'connected') return 'unavailable'
  if (dirty) return 'dirty'
  const priority: Array<[HumanActionKind, string]> = [['promote', 'batch-promote'], ['rework', 'batch-rework'], ['review', 'batch-review'], ['testing', 'batch-test'], ['merge', 'batch-finish']]
  for (const [kind, code] of priority) if (actions.some((a) => a.kind === kind)) return code
  if (github.issues.some((i) => i.state !== 'CLOSED' && i.labels.includes('status:doing'))) return 'continue'
  if (github.issues.some((i) => i.state !== 'CLOSED' && i.labels.includes('status:todo'))) return 'coding'
  if (github.candidate?.state === 'unavailable' || github.unpublishedCommits === null) return 'unavailable'
  if (actions.some((a) => a.kind === 'release')) return 'tag'
  if (actions.some((a) => a.kind === 'deploy')) return 'deploy'
  return 'done'
}
