/* global fetch */
import assert from 'node:assert/strict'
import console from 'node:console'
import process from 'node:process'
const base = 'http://127.0.0.1:8788'
const api = async (path, body) => {
  const response = await fetch(base + path, body === undefined ? undefined : {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  return {status:response.status, data:await response.json()}
}
const projects = (await api('/api/projects')).data
const p = projects.find((item) => item.githubRepo === 'LQY-920/factory-console-acceptance')
assert.ok(p, 'Isolated test project must exist')
const prefix = `/api/projects/${p.id}`
let state
for (let i = 0; i < 3; i++) {
  state = (await api(prefix + '/status')).data
  if (state.github.state === 'connected' && state.github.candidate?.state === 'connected' && state.factory.state === 'connected') break
  console.log('Read-only retry after unavailable GitHub evidence')
}
assert.equal(state.git.state,'connected')
assert.equal(state.github.state,'connected')
assert.equal(state.factory.state,'connected')
assert.deepEqual(state.metrics,{todo:1,review:1,rework:1,testing:1})
for (const kind of ['review','promote','rework','testing','release','deploy']) assert.ok(state.actions.some((a) => a.kind === kind), kind)
assert.equal(state.actions.some((a) => a.kind === 'merge'),process.argv.includes('--ready'),'Final PR readiness must match the requested fixture phase')
console.log(JSON.stringify({phase:'real-state',metrics:state.metrics,actions:state.actions.map((a) => a.kind),candidate:state.github.candidate},null,2))
for (const locale of ['zh-CN','en-US']) {
  const report = await api('/api/reports/daily/preview',{projectId:p.id,locale})
  assert.equal(report.status,200)
  assert.ok(report.data.id)
  assert.ok(report.data.markdown.includes(locale === 'en-US' ? 'Development Brief' : '开发日报'))
  if (locale === 'en-US') assert.doesNotMatch(report.data.markdown,/[\u4e00-\u9fff]/)
}
console.log('Bilingual report persistence passed')
if (process.argv.includes('--exercise-actions')) {
  assert.equal((await api(prefix + '/actions/reviewCollect',{})).status,409)
  assert.equal((await api(prefix + '/actions/constructor',{})).status,400)
  const doctor = await api(prefix + '/actions/doctor',{})
  console.log(JSON.stringify({phase:'doctor',http:doctor.status,exitCode:doctor.data.exitCode,output:doctor.data.output}))
  assert.equal(doctor.status,200)
  const collect = await api(prefix + '/actions/reviewCollect',{confirmed:true})
  console.log(JSON.stringify({phase:'collect',http:collect.status,exitCode:collect.data.exitCode,output:collect.data.output}))
  assert.equal(collect.status,200)
}
console.log('Live acceptance stage passed; no production writes or webhook sends.')
