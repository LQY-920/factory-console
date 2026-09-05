import { resolve } from 'node:path'
import console from 'node:console'
import { createApp } from '../../dist/server/server/app.js'
import { createStore } from '../../dist/server/server/db.js'

const store = createStore(resolve('.data/acceptance/console.sqlite'))
const input = { displayName: 'Factory acceptance', enabled: true, localRepoPath: resolve('.data/acceptance/repo'), githubRepo: 'LQY-920/factory-console-acceptance', factoryScriptPath: 'scripts/factory/factory', prdPath: 'docs/prd.md', batchName: 'acceptance', defaultBranch: 'main', mysql: {host:'',port:3306,database:'',username:''}, deploy: {host:'',port:22,username:'',projectPath:'/srv/factory-console-acceptance',domain:''}, notification: {type:'none',target:''}, dailyReport: {enabled:false,time:'09:00',timezone:'Asia/Shanghai',locale:'en-US'} }
if (!store.listProjects().some((p) => p.githubRepo === input.githubRepo)) store.createProject(input)
if (!store.listProjects().some((p) => p.displayName === 'salon-wall (read-only acceptance)')) store.createProject({ ...input, displayName:'salon-wall (read-only acceptance)', localRepoPath:'D:/projects/salon-wall', githubRepo:'LQY-920/salon-wall', batchName:'mvp-prd', deploy:{...input.deploy,projectPath:''} })
const { app } = createApp({store})
app.listen(8788,'127.0.0.1',() => console.log('Live acceptance: http://127.0.0.1:8788 (real gh + Factory scripts, separate SQLite, scheduler not started)'))
