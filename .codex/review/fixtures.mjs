import process from 'node:process'
export const input = {
  displayName: 'REVIEW-FIXTURE-A', enabled: true, localRepoPath: process.cwd(), githubRepo: 'review/fixture', factoryScriptPath: '.codex/review/fake-factory', prdPath: 'README.md', batchName: 'review-fixture', defaultBranch: 'main',
  mysql: { host: '', port: 3306, database: '', username: '' }, deploy: { host: '', port: 22, username: '', projectPath: '', domain: '' }, notification: { type: 'none', target: '' }, dailyReport: { enabled: false, time: '09:00', timezone: 'Asia/Shanghai' },
}
