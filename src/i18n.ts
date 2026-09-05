import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Locale } from '../shared/types'
import { nextCopy, workflowCopy, diagnosticsCopy } from '../shared/copy'

const zh = {
  nav: { overview: '总览', projects: '项目', pipeline: '流水线', tasks: '人工待办', connections: '连接与凭证', reports: '每日报告', runs: '运行记录', settings: '系统设置' },
  top: { localProject: '本地项目', connected: '连接正常', degraded: '部分不可用', noProject: '未选择项目', refresh: '刷新状态', refreshing: '正在刷新', startBatch: '开始批次', language: '语言', zhLabel: '中文' },
  metrics: { todo: '待开发', review: '待批改', testing: '待测试', rework: '待返工' },
  pipeline: { title: '流水线状态', prd: 'PRD', issues: 'Issue', develop: '开发', collect: '收集', humanReview: '人工批改', candidateTest: '候选测试', release: '发版', deploy: '部署', knowledge: '沉淀', complete: '已完成', active: '进行中', human: '需处理', blocked: '阻塞', pending: '等待', integrationRole: '收作业', candidateRole: '只含已批准代码', mainRole: '稳定发布', machineFields: 'Factory 机器字段', noMachineFields: '当前没有可用机器字段；刷新后由只读适配器计算 NEXT、BATCH、BRANCH。', toolHealth: '工具健康状态' },
  overview: { connectionTitle: '项目与连接状态', actionsTitle: '今天需要你处理', noActions: '当前没有必须由你处理的事项', security: '凭证仅保存引用，明文不进入浏览器、日志或 Git 仓库。', refreshed: '更新于 {{time}}', unavailableHint: '工具未配置或不可用时会在这里明确显示。' },
  connection: { localRepo: '本地仓库', github: 'GitHub 仓库', prdBatch: 'PRD 批次', factory: 'Factory 脚本', mysql: 'MySQL', deploy: '部署环境', notification: '通知渠道', connected: '已连接', configured: '已配置', unavailable: '不可用', notConfigured: '未配置', dirty: '有未提交修改', clean: '工作树干净', behind: '落后 {{count}} 个提交', current: '当前分支' },
  actions: { review: '{{count}} 个 PR 等待批改', testing: '{{count}} 个批准项等待候选测试', rework: '{{count}} 个事项等待返工', merge: '{{count}} 个总 PR 等待最终合入', release: '{{count}} 个版本等待发布', deploy: '{{count}} 个 Release 等待人工部署', open: '打开', reviewButton: '去批改', testsButton: '查看测试', feedbackButton: '查看意见', mergeButton: '查看合入', releaseButton: '查看发布', deployButton: '查看命令', collect: '收集批改结果' },
  tasks: { subtitle: '由真实 Issue、PR、Review 和候选分支状态计算，只展示需要人做判断的关口。' },
  schedule: { title: '自动化计划', description: '每日 {{time}} 生成开发日报', destination: '通知：{{target}}', localOnly: '仅生成本地报告', view: '查看计划', enabled: '已启用', disabled: '已停用', timezone: '时区' },
  projects: { title: '项目配置', subtitle: '添加多个本地项目，配置互相隔离。', add: '新增项目', edit: '编辑项目', save: '保存项目', cancel: '取消', delete: '删除项目', empty: '还没有项目。添加一个本地仓库开始读取真实状态。', enabled: '启用项目', displayName: '显示名称', localRepoPath: '本地仓库路径', githubRepo: 'GitHub 仓库', factoryScriptPath: 'Factory 脚本路径', prdPath: 'PRD 路径', batchName: '批次名', defaultBranch: '默认分支', mysqlTitle: 'MySQL', host: '主机', port: '端口', database: '数据库', username: '用户名', passwordSecretRef: '密码环境变量', deployTitle: '部署', projectPath: '项目路径', domain: '域名', credentialSecretRef: '凭证环境变量', notificationTitle: '通知', notificationType: '类型', target: 'Webhook 地址环境变量', webhookSecretRef: 'Webhook 密钥环境变量', dailyTitle: '日报计划', time: '时间', timezone: '时区', validate: '检查连接', validating: '正在检查', created: '项目已创建', updated: '项目已更新', deleted: '项目已删除', none: '不发送', webhook: '通用 Webhook', confirmDelete: '确定删除项目“{{name}}”吗？运行记录和日报也会删除，最小审计记录保留。' },
  validation: { title: '连接检查结果', valid: '基础连接可用', invalid: '仍有项目需要配置', localRepo: '本地仓库', git: 'Git', factory: 'Factory 脚本', prd: 'PRD', mysqlSecret: 'MySQL 凭证引用', deploySecret: '部署凭证引用' },
  reports: { title: '开发日报', subtitle: '从实时状态生成，可预览并导出 Markdown。', preview: '生成预览', generating: '正在生成', download: '导出 Markdown', send: '发送 Webhook', sending: '正在发送', empty: '生成后将在这里显示日报内容。', sent: '日报已发送', localOnly: '已保存到本地，尚未发送。' },
  runs: { title: '运行记录', project: '项目', action: '动作', started: '执行时间', status: '状态', exitCode: '退出码', output: '脱敏输出', allProjects: '所有项目', allStatuses: '所有状态', success: '成功', failed: '失败', running: '运行中', empty: '暂无运行记录。执行 doctor、收集批改或生成日报后会出现在这里。', viewOutput: '查看输出' },
  settings: { title: '系统设置', language: '界面语言', storage: '本地数据目录', security: '安全模型', securityText: 'SQLite 仅保存非敏感配置和脱敏运行记录。MVP 的凭证提供器只读取环境变量；Windows Credential Manager / DPAPI 尚未实现。', demo: '演示数据模式', demoOff: '关闭（默认）', about: '关于', aboutText: 'Factory Skills 的本地优先、多项目人工协作控制台。' },
  confirm: { title: '确认执行高风险操作', project: '项目', prd: 'PRD', batch: '批次', command: '将执行的命令', impact: '影响范围', impactBatch: '拉取远程、切换本地默认分支，创建或复用批次分支和 Milestone，并将所有 open 且带 todo/doing/review 状态的 Issue 加入本批次（可能重新分配已有批次）。不会合入 main、打 Tag 或部署。最长 3 分钟；超时不等于回滚。', impactCollect: '读取批改评论，更新批准/返工标签和批改清单；不会晋级代码。最长 3 分钟，超时不等于回滚。', cancel: '取消', confirm: '确认执行', running: '正在执行' },
  command: { doctor: '运行 Factory doctor', reviewCollect: '收集批改结果', batchStart: '开始批次', copyPrompt: '复制启动提示词', copied: '已复制', success: '命令执行成功', failed: '命令失败或超时，可能已部分生效。请检查运行记录和远程状态后再重试。' },
  status: { loading: '正在读取真实状态…', unavailable: '状态不可用', noProject: '请先添加并选择一个项目。', retry: '重试', demo: '演示数据' },
  common: { close: '关闭', save: '保存', reset: '重置', configured: '已配置', notConfigured: '未配置', yes: '是', no: '否' },
  errors: { invalidProject: '项目配置无效，请检查输入。', projectNotFound: '项目不存在或已删除。', actionNotAllowed: '该操作不在安全白名单中。', confirmationRequired: '此操作需要二次确认。', invalidReportRequest: '日报请求无效。', notificationFailed: 'Webhook 发送失败，请检查配置。', internal: '发生内部错误。', network: '无法连接本地后端。', loadProjects: '加载项目失败。', loadStatus: '读取项目状态失败。', loadRuns: '读取运行记录失败。' }
}

const en = {
  nav: { overview: 'Overview', projects: 'Projects', pipeline: 'Pipeline', tasks: 'Human Tasks', connections: 'Connections & Secrets', reports: 'Daily Brief', runs: 'Run History', settings: 'Settings' },
  top: { localProject: 'Local Project', connected: 'Connected', degraded: 'Partly Unavailable', noProject: 'No Project', refresh: 'Refresh', refreshing: 'Refreshing', startBatch: 'Start Batch', language: 'Language', zhLabel: 'ZH' },
  metrics: { todo: 'To Develop', review: 'Awaiting Review', testing: 'Testing', rework: 'Rework' },
  pipeline: { title: 'Pipeline Status', prd: 'PRD', issues: 'Issues', develop: 'Develop', collect: 'Collect', humanReview: 'Human Review', candidateTest: 'Candidate Test', release: 'Release', deploy: 'Deploy', knowledge: 'Knowledge', complete: 'Complete', active: 'Active', human: 'Action Required', blocked: 'Blocked', pending: 'Pending', integrationRole: 'collects work', candidateRole: 'contains approved code only', mainRole: 'stays release-ready', machineFields: 'Factory Machine Fields', noMachineFields: 'No machine fields are available. Refresh to derive NEXT, BATCH and BRANCH with the read-only adapter.', toolHealth: 'Tool Health' },
  overview: { connectionTitle: 'Project & Connection Status', actionsTitle: 'Action Required Today', noActions: 'No action currently requires your attention', security: 'Only secret references are stored. Plaintext never enters the browser, logs, or Git repository.', refreshed: 'Updated {{time}}', unavailableHint: 'Missing or unavailable tools are reported explicitly here.' },
  connection: { localRepo: 'Local Repository', github: 'GitHub Repository', prdBatch: 'PRD Batch', factory: 'Factory Script', mysql: 'MySQL', deploy: 'Deployment', notification: 'Notification', connected: 'Connected', configured: 'Configured', unavailable: 'Unavailable', notConfigured: 'Not Configured', dirty: 'Uncommitted changes', clean: 'Working tree clean', behind: '{{count}} commits behind', current: 'Current branch' },
  actions: { review_one: '{{count}} PR awaiting review', review_other: '{{count}} PRs awaiting review', testing_one: '{{count}} approved item awaiting candidate test', testing_other: '{{count}} approved items awaiting candidate test', rework_one: '{{count}} item requires rework', rework_other: '{{count}} items require rework', merge_one: '{{count}} final PR awaiting merge', merge_other: '{{count}} final PRs awaiting merge', release_one: '{{count}} version awaiting release', release_other: '{{count}} versions awaiting release', deploy_one: '{{count}} Release awaiting manual deployment', deploy_other: '{{count}} Releases awaiting manual deployment', open: 'Open', reviewButton: 'Review', testsButton: 'View Tests', feedbackButton: 'View Feedback', mergeButton: 'View Merge', releaseButton: 'View Release', deployButton: 'View Commands', collect: 'Collect Reviews' },
  tasks: { subtitle: 'Calculated from live Issues, PRs, reviews, and candidate branches. Only human decision gates are shown.' },
  schedule: { title: 'Automation Schedule', description: 'Generate daily development brief at {{time}}', destination: 'Notify: {{target}}', localOnly: 'Generate locally only', view: 'View Schedule', enabled: 'Enabled', disabled: 'Disabled', timezone: 'Timezone' },
  projects: { title: 'Project Configuration', subtitle: 'Add multiple isolated local projects.', add: 'Add Project', edit: 'Edit Project', save: 'Save Project', cancel: 'Cancel', delete: 'Delete Project', empty: 'No projects yet. Add a local repository to start reading real status.', enabled: 'Project enabled', displayName: 'Display name', localRepoPath: 'Local repository path', githubRepo: 'GitHub repository', factoryScriptPath: 'Factory script path', prdPath: 'PRD path', batchName: 'Batch name', defaultBranch: 'Default branch', mysqlTitle: 'MySQL', host: 'Host', port: 'Port', database: 'Database', username: 'Username', passwordSecretRef: 'Password environment variable', deployTitle: 'Deployment', projectPath: 'Project path', domain: 'Domain', credentialSecretRef: 'Credential environment variable', notificationTitle: 'Notification', notificationType: 'Type', target: 'Webhook URL environment variable', webhookSecretRef: 'Webhook secret environment variable', dailyTitle: 'Daily brief schedule', time: 'Time', timezone: 'Timezone', validate: 'Check Connections', validating: 'Checking', created: 'Project created', updated: 'Project updated', deleted: 'Project deleted', none: 'Do not send', webhook: 'Generic Webhook', confirmDelete: 'Delete “{{name}}”? Its run history and reports will be removed; minimal audit records are retained.' },
  validation: { title: 'Connection Check Results', valid: 'Core connection is available', invalid: 'Some setup still needs attention', localRepo: 'Local repository', git: 'Git', factory: 'Factory script', prd: 'PRD', mysqlSecret: 'MySQL secret reference', deploySecret: 'Deployment secret reference' },
  reports: { title: 'Development Brief', subtitle: 'Generated from live state, available for preview and Markdown export.', preview: 'Generate Preview', generating: 'Generating', download: 'Export Markdown', send: 'Send Webhook', sending: 'Sending', empty: 'The generated brief will appear here.', sent: 'Brief sent', localOnly: 'Saved locally; not sent.' },
  runs: { title: 'Run History', project: 'Project', action: 'Action', started: 'Started', status: 'Status', exitCode: 'Exit code', output: 'Redacted output', allProjects: 'All Projects', allStatuses: 'All Statuses', success: 'Success', failed: 'Failed', running: 'Running', empty: 'No runs yet. Doctor, review collection, and report delivery will appear here.', viewOutput: 'View Output' },
  settings: { title: 'Settings', language: 'Interface language', storage: 'Local data directory', security: 'Security model', securityText: 'SQLite stores only non-sensitive configuration and redacted run logs. The MVP secret provider reads environment variables only; Windows Credential Manager / DPAPI is not implemented.', demo: 'Demo data mode', demoOff: 'Off (default)', about: 'About', aboutText: 'A local-first, multi-project human collaboration console for Factory Skills.' },
  confirm: { title: 'Confirm high-impact action', project: 'Project', prd: 'PRD', batch: 'Batch', command: 'Command to execute', impact: 'Impact', impactBatch: 'Fetches remote state, checks out the local default branch, creates/reuses batch branches and a Milestone, and assigns ALL open todo/doing/review Issues to this batch (including reassignment from existing batches). No main merge, Tag, or deployment. Up to 3 minutes; a timeout does not roll back changes.', impactCollect: 'Reads review comments, updates approval/rework labels and the review dashboard; does not promote code. Up to 3 minutes; a timeout does not roll back changes.', cancel: 'Cancel', confirm: 'Confirm & Run', running: 'Running' },
  command: { doctor: 'Run Factory doctor', reviewCollect: 'Collect Review Results', batchStart: 'Start Batch', copyPrompt: 'Copy Start Prompt', copied: 'Copied', success: 'Command completed', failed: 'Command failed or timed out; partial changes may exist. Check Run History and remote state before retrying.' },
  status: { loading: 'Reading live state…', unavailable: 'Status unavailable', noProject: 'Add and select a project first.', retry: 'Retry', demo: 'Demo Data' },
  common: { close: 'Close', save: 'Save', reset: 'Reset', configured: 'Configured', notConfigured: 'Not Configured', yes: 'Yes', no: 'No' },
  errors: { invalidProject: 'Project configuration is invalid. Check the inputs.', projectNotFound: 'The project does not exist or was deleted.', actionNotAllowed: 'This action is not in the safe allowlist.', confirmationRequired: 'This action requires confirmation.', invalidReportRequest: 'The report request is invalid.', notificationFailed: 'Webhook delivery failed. Check the configuration.', internal: 'An internal error occurred.', network: 'Cannot connect to the local backend.', loadProjects: 'Projects could not be loaded.', loadStatus: 'Project status could not be read.', loadRuns: 'Run history could not be loaded.' }
}

const saved = typeof window !== 'undefined' ? window.localStorage.getItem('factory-console.locale') : null
const initialLocale: Locale = saved === 'en-US' ? 'en-US' : 'zh-CN'
if (typeof document !== 'undefined') document.documentElement.lang = initialLocale

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: { ...zh, next: nextCopy['zh-CN'], workflow: workflowCopy['zh-CN'], diagnostics: diagnosticsCopy['zh-CN'],
      actions: { ...zh.actions, promote: '{{count}} 个批准项等待晋级', promoteButton: '查看批准项', testing: '{{count}} 份候选测试证据待确认' },
      errors: { ...zh.errors, localOnly: '仅允许本地同源访问。', projectBusy: '项目已停用或正在执行其他操作。' },
      audit: { projectCreate: '新增项目', projectUpdate: '更新项目', projectDelete: '删除项目', dailyReportPreview: '预览日报', dailyReportGenerate: '生成定时日报', dailyReportSend: '发送日报' },
      command: { ...zh.command, startPrompt: '开始编码，批量处理 {{batch}}；先读取项目规则与 PRD。' },
      languages: { zh: '中文', en: '英文' },
      validation: { ...zh.validation, github: 'GitHub 登录' } } },
    'en-US': { translation: { ...en, next: nextCopy['en-US'], workflow: workflowCopy['en-US'], diagnostics: diagnosticsCopy['en-US'],
      actions: { ...en.actions, promote_one: '{{count}} approved submission awaiting promotion', promote_other: '{{count}} approved submissions awaiting promotion', promoteButton: 'View Approvals', testing_one: '{{count}} candidate test document awaiting confirmation', testing_other: '{{count}} candidate test documents awaiting confirmation' },
      errors: { ...en.errors, localOnly: 'Local same-origin access only.', projectBusy: 'Project is disabled or another command is running.' },
      audit: { projectCreate: 'Create project', projectUpdate: 'Update project', projectDelete: 'Delete project', dailyReportPreview: 'Preview report', dailyReportGenerate: 'Generate scheduled report', dailyReportSend: 'Send report' },
      command: { ...en.command, startPrompt: 'Start coding batch {{batch}}. Read project rules and the PRD first.' },
      languages: { zh: 'Chinese', en: 'English' },
      validation: { ...en.validation, github: 'GitHub authentication' } } }
  },
  lng: initialLocale,
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (locale) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('factory-console.locale', locale)
    document.documentElement.lang = locale
  }
})

export default i18n
