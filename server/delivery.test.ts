// @vitest-environment node
import { createServer } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sendDailyReport } from './reports.js'
import { createStore } from './db.js'
import type { DailyReportPreview, ProjectInput } from '../shared/types.js'

const input: ProjectInput = {displayName:'Delivery fixture', enabled:true, localRepoPath:process.cwd(), factoryScriptPath:'scripts/factory/factory', prdPath:'README.md', batchName:'test', defaultBranch:'main', mysql:{host:'',port:3306,database:'',username:''}, deploy:{host:'',port:22,username:'',projectPath:'',domain:''}, notification:{type:'webhook',target:'FIXTURE_WEBHOOK_URL',webhookSecretRef:'FIXTURE_BEARER'}, dailyReport:{enabled:true,time:'09:00',timezone:'UTC',locale:'en-US'}}

describe('real local webhook and durable storage', () => {
  it('posts actual Markdown and server-only bearer, reports HTTP failures and blocks redirects', async () => {
    const requests: Array<{path:string; body:string; authorization?:string}> = []
    const server = createServer(async (req,res) => {
      let body = ''; for await (const part of req) body += part
      requests.push({path:req.url!,body,authorization:req.headers.authorization})
      if (req.url === '/redirect') {res.writeHead(302,{location:'/unexpected'});res.end();return}
      res.writeHead(req.url === '/failure' ? 503 : 200); res.end()
    })
    server.listen(0,'127.0.0.1'); await once(server,'listening')
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const store = createStore(':memory:'); const project = store.createProject(input)
    const preview: DailyReportPreview = {projectId:project.id,generatedAt:new Date().toISOString(),markdown:'# Synthetic brief',sent:false,notificationConfigured:true}
    let path = '/ok'
    const secrets = {isConfigured:()=>true,resolve:(ref?:string)=>ref === 'FIXTURE_WEBHOOK_URL' ? base+path : 'SYNTHETIC-BEARER'}
    try {
      expect((await sendDailyReport(preview,project,secrets)).sent).toBe(true)
      expect(requests[0]).toEqual({path:'/ok',body:JSON.stringify({text:preview.markdown}),authorization:'Bearer SYNTHETIC-BEARER'})
      path = '/failure'; await expect(sendDailyReport(preview,project,secrets)).rejects.toThrow('notification_failed_503')
      path = '/redirect'; await expect(sendDailyReport(preview,project,secrets)).rejects.toThrow()
      expect(requests.some((r)=>r.path === '/unexpected')).toBe(false)
      expect(JSON.stringify(store.listProjects())).not.toContain(base)
      expect(JSON.stringify(store.listProjects())).not.toContain('SYNTHETIC-BEARER')
    } finally {store.close();server.closeAllConnections(); await new Promise<void>((resolve)=>server.close(()=>resolve()))}
  })
  it('retains projects, locale, schedule, reports and audits after reopening the database', () => {
    const directory = mkdtempSync(join(tmpdir(),'factory-console-durable-'))
    const file = join(directory,'test.sqlite')
    let store = createStore(file)
    try {
      const project = store.createProject(input)
      store.saveReport({projectId:project.id,generatedAt:new Date().toISOString(),markdown:'Persisted fixture',sent:false,notificationConfigured:false,locale:'en-US'},'2026-09-05')
      store.audit(project.id,'projectCreate')
      store.close();store = createStore(file)
      expect(store.getProject(project.id)?.dailyReport).toEqual(input.dailyReport)
      expect(store.listReports(project.id)[0].markdown).toBe('Persisted fixture')
      expect(store.hasScheduledReport(project.id,'2026-09-05')).toBe(true)
      expect(store.listRuns(project.id)[0].action).toBe('projectCreate')
    } finally {store.close();rmSync(directory,{recursive:true,force:true})}
  })
})
