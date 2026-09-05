export type Locale = 'zh-CN' | 'en-US'
export type Availability = 'connected' | 'configured' | 'unavailable' | 'notConfigured'
export type PipelineState = 'complete' | 'active' | 'human' | 'blocked' | 'pending'
export type ActionId = 'doctor' | 'reviewCollect' | 'batchStart'

export interface SecretRefConfig {
  passwordSecretRef?: string
  credentialSecretRef?: string
  webhookSecretRef?: string
}

export interface ProjectConfig {
  id: string
  displayName: string
  enabled: boolean
  localRepoPath: string
  githubRepo?: string
  factoryScriptPath: string
  prdPath: string
  batchName: string
  defaultBranch: string
  mysql: {
    host: string
    port: number
    database: string
    username: string
    passwordSecretRef?: string
  }
  deploy: {
    host: string
    port: number
    username: string
    projectPath: string
    domain: string
    credentialSecretRef?: string
  }
  notification: {
    type: 'none' | 'webhook'
    target: string
    webhookSecretRef?: string
  }
  dailyReport: {
    enabled: boolean
    time: string
    timezone: string
    locale?: Locale
  }
  createdAt: string
  updatedAt: string
}

export type ProjectInput = Omit<ProjectConfig, 'id' | 'createdAt' | 'updatedAt'>

export interface ToolState {
  state: Availability
  message?: string
}

export interface GitState extends ToolState {
  currentBranch?: string
  dirty?: boolean
  origin?: string
  latestCommit?: string
  latestCommitAt?: string
  behind?: number | null
}

export interface GithubIssue {
  number: number
  title: string
  labels: string[]
  url: string
  body?: string
  state?: string
  closedAt?: string
  milestone?: string
  dependencies?: number[]
}

export interface GithubPullRequest {
  number: number
  title: string
  url: string
  reviewDecision: string
  isDraft: boolean
  baseRefName: string
  headRefName: string
  body?: string
  state?: string
  mergedAt?: string
  updatedAt?: string
  labels?: string[]
  issueNumber?: number
  promoted?: boolean
  feedback?: string
  decisionSource?: string
}

export interface GithubRelease { tagName: string; url: string; publishedAt?: string; body?: string; deployed?: boolean }
export interface CandidateEvidence extends ToolState {
  total: number
  pending: number
  files: Array<{ path: string; url: string; pending: number }>
}

export interface GithubState extends ToolState {
  repo?: string
  issues: GithubIssue[]
  issueStates?: Record<number, string>
  pullRequests: GithubPullRequest[]
  latestRelease?: GithubRelease
  releases?: GithubRelease[]
  milestones?: Array<{ title: string; state: string; url: string }>
  tags?: string[]
  unpublishedCommits?: number | null
  candidate?: CandidateEvidence
  history?: Array<{ kind: 'issue' | 'pr'; number: number; title: string; url: string; completedAt: string }>
}

export interface FactoryState extends ToolState {
  fields: Record<string, string>
  sections: Record<string, string[]>
  nextCode?: string
  summary?: string
}

export interface MetricCounts {
  todo: number | null
  review: number | null
  testing: number | null
  rework: number | null
}

export type HumanActionKind = 'review' | 'promote' | 'testing' | 'rework' | 'merge' | 'release' | 'deploy'

export interface HumanAction {
  id: string
  kind: HumanActionKind
  count: number
  titleKey: string
  targetUrl?: string
  sourceId?: number
  items?: Array<{ title: string; url?: string; sourceId?: number; feedback?: string; blockedBy?: number[]; command?: string }>
}

export interface PipelineStep {
  id: string
  labelKey: string
  state: PipelineState
  count?: number
  detail?: string
}

export interface ProjectStatus {
  projectId: string
  refreshedAt: string
  git: GitState
  github: GithubState
  factory: FactoryState
  metrics: MetricCounts
  actions: HumanAction[]
  pipeline: PipelineStep[]
  secrets: {
    mysqlConfigured: boolean
    deployConfigured: boolean
    webhookConfigured: boolean
  }
  demo: boolean
}

export interface RunRecord {
  id: string
  projectId: string
  action: string
  command: string
  startedAt: string
  finishedAt: string
  exitCode: number | null
  status: 'success' | 'failed' | 'running'
  output: string
}

export interface ValidationResult {
  valid: boolean
  checks: Array<{ key: string; ok: boolean; message: string }>
}

export interface DailyReportPreview {
  projectId: string
  generatedAt: string
  markdown: string
  sent: boolean
  notificationConfigured: boolean
  id?: string
  locale?: Locale
  deliveryError?: string
}

export interface ApiError {
  error: string
  errorKey: string
  details?: unknown
}
