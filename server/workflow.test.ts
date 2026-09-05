// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { calculateHumanActions, readonlyNext } from './workflow.js'
import { dependencies, latestDecision, parseTestEvidence } from './github.js'
import type { GithubState, GithubPullRequest, ProjectConfig, FactoryState } from '../shared/types.js'

const project = { batchName: 'batch-a', defaultBranch: 'main', deploy: { projectPath: '/srv/example' } } as ProjectConfig
const factory: FactoryState = { state: 'connected', fields: {}, sections: {} }
const empty: GithubState = { state: 'connected', repo: 'example/repo', issues: [], pullRequests: [] }
const pr: GithubPullRequest = { number: 2, issueNumber: 1, title: 'Feature', url: 'https://example.test/pr/2', headRefName: 'feat/issue-1', baseRefName: 'integration/batch-a', isDraft: false, reviewDecision: '', state: 'MERGED', mergedAt: '2026-09-04T10:00:00Z' }
const issue = { number: 1, title: 'Feature', url: 'https://example.test/issue/1', labels: ['status:review'], state: 'OPEN' }
describe('batch workflow acceptance matrix', () => {
  it('uses newer human decisions over stale labels, including dismissed reviews', () => {
    const approved = calculateHumanActions({ ...empty, pullRequests: [{ ...pr, reviewDecision: 'APPROVED', decisionSource: 'comment', labels: ['review:changes-requested'] }] }, factory, project)
    expect(approved.actions.map((a) => a.kind)).toEqual(['promote'])
    const dismissed = latestDecision([{ body: '', state: 'DISMISSED', author_association: 'OWNER', submitted_at: '2026-09-05' }], ['review:approved'])
    expect(calculateHumanActions({ ...empty, pullRequests: [{ ...pr, ...dismissed, labels: ['review:approved'] }] }, factory, project).actions.map((a) => a.kind)).toEqual(['review'])
  })
  it('does not count ordinary development as rework', () => expect(calculateHumanActions({ ...empty, issues: [{ ...issue, labels: ['status:doing'] }] }, factory, project).metrics.rework).toBe(0))
  it('deduplicates PR and Issue, reads approved merged submissions as promotion not tests', () => {
    const result = calculateHumanActions({ ...empty, issues: [issue], pullRequests: [{ ...pr, reviewDecision: 'APPROVED' }] }, factory, project)
    expect(result.metrics).toEqual({ todo: 0, review: 0, rework: 0, testing: 0 })
    expect(result.actions.map((a) => a.kind)).toEqual(['promote'])
  })
  it('uses the latest submission and identifies blocking dependencies', () => {
    const result = calculateHumanActions({ ...empty, issues: [{ ...issue, dependencies: [9] }], pullRequests: [{ ...pr, reviewDecision: 'CHANGES_REQUESTED' }, { ...pr, number: 3, mergedAt: '2026-09-05T10:00:00Z', reviewDecision: 'APPROVED' }] }, factory, project)
    expect(result.actions[0]).toMatchObject({ kind: 'promote', count: 1, items: [{ sourceId: 3, blockedBy: [9] }] })
  })
  it('removes promoted entries and derives tests only from candidate evidence', () => {
    const result = calculateHumanActions({ ...empty, issues: [issue], pullRequests: [{ ...pr, promoted: true, reviewDecision: 'APPROVED' }], candidate: { state: 'connected', total: 3, pending: 2, files: [{ path: 'test.md', url: 'https://example.test/tests', pending: 2 }] } }, factory, project)
    expect(result.actions.map((a) => a.kind)).toEqual(['testing'])
    expect(result.metrics.testing).toBe(2)
  })
  it('never proposes a draft or another batch final PR for merge', () => {
    const result = calculateHumanActions({ ...empty, pullRequests: [{ ...pr, headRefName: 'candidate/batch-a', baseRefName: 'main', state: 'OPEN', isDraft: true }, { ...pr, headRefName: 'candidate/other', baseRefName: 'main', state: 'OPEN' }] }, factory, project)
    expect(result.actions).toHaveLength(0)
  })
  it('proposes ready final PRs and subsequent releases even when prior releases exist', () => {
    const result = calculateHumanActions({ ...empty, unpublishedCommits: 2, latestRelease: {tagName: 'v1', url: 'u', deployed: true}, pullRequests: [{ ...pr, headRefName: 'candidate/batch-a', baseRefName: 'main', state: 'OPEN' }] }, factory, project)
    expect(result.actions.map((a) => a.kind)).toEqual(['merge', 'release'])
  })
  it('omits deployed releases and generates manual commands only for pending releases', () => {
    const result = calculateHumanActions({ ...empty, releases: [{ tagName: 'v1', url: 'u1', body: '✅ 已上线 2026-09-04' }, { tagName: 'v2', url: 'u2' }] }, factory, project)
    expect(result.actions[0]).toMatchObject({ kind: 'deploy', count: 1, items: [{title: 'v2'}] })
    expect(result.actions[0].items?.[0].command).toContain('git checkout --detach')
  })
  it('renders unavailable as unknown counts rather than fake zeroes', () => {
    const result = calculateHumanActions({ ...empty, state: 'unavailable' }, factory, project)
    expect(Object.values(result.metrics)).toEqual([null, null, null, null])
    expect(readonlyNext({ ...empty, state: 'unavailable' }, [], false)).toBe('unavailable')
  })
})
describe('Factory review and test evidence contracts', () => {
  it('uses latest trusted decision and ignores untrusted approval', () => {
    expect(latestDecision([
      {body: '/factory approve', author_association: 'OWNER', updated_at: '2026-09-04'},
      {body: '/factory request-changes\nFix this', author_association: 'COLLABORATOR', updated_at: '2026-09-05'},
      {body: '/factory approve', author_association: 'NONE', updated_at: '2026-09-06'},
    ], [])).toMatchObject({reviewDecision: 'CHANGES_REQUESTED', feedback: '/factory request-changes\nFix this'})
  })
  it.each(['', '- 执行结果: 未执行', '- 执行结果: ❌ 失败', '- Result: NOT PASSED', '- 执行结果: 尚未通过'])('treats missing or failed P0 evidence as pending: %s', (result) => {
    expect(parseTestEvidence(`### TC-1\n- 优先级: P0\n${result}`)).toEqual({ total: 1, pending: 1 })
  })
  it('accepts passing bilingual P0/P1 evidence but not P2 as the gate', () => {
    expect(parseTestEvidence('### TC-1\n- Priority: P0\n- Result: PASS\n### TC-2\n- 优先级: P1\n- 执行结果: ✅ 通过\n### TC-3\n- Priority: P2\n- Result: FAIL')).toEqual({total: 2, pending: 0})
    expect(dependencies('## 依赖\n- #2\n- #4\n## 验收\n#9')).toEqual([2,4])
  })
})
