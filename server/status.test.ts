// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { FactoryState, GithubState, ProjectConfig } from '../shared/types.js'
import { calculateHumanActions, parseFactoryOutput } from './status.js'

const project = { batchName: 'mvp-prd', defaultBranch: 'main' } as ProjectConfig

describe('Factory output parser', () => {
  it('parses status sections and machine-readable next fields', () => {
    const parsed = parseFactoryOutput('[status:todo]\n  #8 item\n[status:review]\n #7 review', 'NEXT=batch-review\nBATCH=mvp-prd\n等待批改')
    expect(parsed.sections['status:todo']).toEqual(['#8 item'])
    expect(parsed.sections['status:review']).toEqual(['#7 review'])
    expect(parsed.fields).toMatchObject({ NEXT: 'batch-review', BATCH: 'mvp-prd' })
    expect(parsed.nextCode).toBe('batch-review')
  })
})

describe('human action calculation', () => {
  it('maps todo, review, approved and changes-requested state into queues', () => {
    const github: GithubState = { state: 'connected', issues: [
      { number: 1, title: 'Todo', labels: ['status:todo'], url: 'u1' },
      { number: 2, title: 'Doing', labels: ['status:doing'], url: 'u2' },
      { number: 3, title: 'Review', labels: ['status:review'], url: 'u3' },
    ], pullRequests: [
      { number: 3, issueNumber: 3, title: 'Review', url: 'p3', reviewDecision: '', isDraft: false, baseRefName: 'integration/mvp-prd', headRefName: 'feat/issue-3' },
      { number: 4, title: 'Approved', url: 'p4', reviewDecision: 'APPROVED', isDraft: false, baseRefName: 'integration/mvp-prd', headRefName: 'feat/4' },
      { number: 5, title: 'Changes', url: 'p5', reviewDecision: 'CHANGES_REQUESTED', isDraft: false, baseRefName: 'integration/mvp-prd', headRefName: 'feat/5' },
    ] }
    const factory: FactoryState = { state: 'connected', fields: {}, sections: {} }
    const result = calculateHumanActions(github, factory, project)
    expect(result.metrics).toEqual({ todo: 1, review: 1, testing: 0, rework: 1 })
    expect(result.actions.map((action) => action.kind)).toEqual(expect.arrayContaining(['review', 'promote', 'rework']))
  })
})
