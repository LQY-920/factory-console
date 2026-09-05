// Explicit opt-in, isolated GitHub fixture creation. Never targets a production repository.
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import console from 'node:console'
import { Buffer } from 'node:buffer'

const repo = 'LQY-920/factory-console-acceptance'
if (!process.argv.includes('--create-fixtures')) throw new Error('Pass --create-fixtures to authorize isolated fixture writes')
const gh = (method, endpoint, body) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return JSON.parse(execFileSync('gh', ['api', '--method', method, `repos/${repo}/${endpoint}`, ...(body ? ['--input', '-'] : [])], { encoding: 'utf8', input: body ? JSON.stringify(body) : undefined, windowsHide: true, stdio: ['pipe','pipe','pipe'] })) }
    catch (error) { if (attempt === 2 || !String(error.stderr).includes('dial tcp')) throw error; console.log('Connection failed before request; retrying isolated fixture operation.') }
  }
}
const putFile = (path, branch, text, message) => {
  try { gh('GET',`contents/${path}?ref=${encodeURIComponent(branch)}`); return } catch (error) { if (!String(error.stderr).includes('404')) throw error }
  gh('PUT',`contents/${path}`,{message,content:Buffer.from(text).toString('base64'),branch})
}
const labels = ['status:todo','status:doing','status:review','Feature','Bug','Improvement','review:approved','review:changes-requested','review:promoted']
const existingLabels = gh('GET', 'labels?per_page=100')
for (const name of labels) {
  const found = existingLabels.find((l) => l.name.toLowerCase() === name.toLowerCase())
  if (!found) gh('POST','labels',{name,color:'1488CC'})
  else if (found.name !== name) gh('PATCH',`labels/${encodeURIComponent(found.name)}`,{new_name:name})
}
const milestones = gh('GET','milestones?state=all&per_page=100')
const milestone = milestones.find((m) => m.title === 'acceptance') ?? gh('POST','milestones',{title:'acceptance'})
const existingIssues = gh('GET', 'issues?state=all&per_page=100').filter((i) => !i.pull_request)
const issues = []
for (const [name, label] of [['Review','status:review'],['Approved','status:review'],['Rework','status:review'],['Todo','status:todo'],['Doing','status:doing']]) {
  issues.push(existingIssues.find((i) => i.title === `[Acceptance] ${name}`) ?? gh('POST', 'issues', {title:`[Acceptance] ${name}`,body:'Synthetic acceptance fixture. No production work.',labels:[label],milestone:milestone.number}))
}
const main = gh('GET','git/ref/heads/main').object.sha
const refs = gh('GET','git/matching-refs/heads/')
const branch = (name, sha) => { if (!refs.some((r) => r.ref === `refs/heads/${name}`)) { gh('POST','git/refs',{ref:`refs/heads/${name}`,sha}); refs.push({ref:`refs/heads/${name}`}) } }
branch('integration/acceptance', main); branch('candidate/acceptance', main)
const allPrs = gh('GET','pulls?state=all&per_page=100')
const submitted = []
for (const issue of issues.slice(0,3)) {
  const name = `feat/issue-${issue.number}-acceptance`
  let pr = allPrs.find((p) => p.head.ref === name)
  if (!pr) {
    branch(name, gh('GET','git/ref/heads/integration/acceptance').object.sha)
    putFile(`fixtures/issue-${issue.number}.txt`,name,`Acceptance issue ${issue.number}\n`,`fixture for issue ${issue.number}`)
    pr = gh('POST','pulls',{title:issue.title,head:name,base:'integration/acceptance',body:`Refs #${issue.number}`})
  }
  if (pr.state === 'open') gh('PUT',`pulls/${pr.number}/merge`,{merge_method:'merge'})
  submitted.push(pr)
}
for (const [index, body] of [[1,'/factory approve\nApproved acceptance fixture.'],[2,'/factory request-changes\nFix the synthetic failing case.']]) {
  const comments = gh('GET',`issues/${submitted[index].number}/comments`)
  if (!comments.some((c) => c.body === body)) gh('POST',`issues/${submitted[index].number}/comments`,{body})
}
let final = allPrs.find((p) => p.head.ref === 'candidate/acceptance')
if (!final) {
  putFile('docs/tests/console-acceptance-testcases.md','candidate/acceptance','# Candidate acceptance\n\n### TC-1\n- Priority: P0\n- Result: PASS\n\n### TC-2\n- Priority: P1\n- Result: NOT RUN\n','candidate test evidence')
  final = gh('POST','pulls',{title:'[Acceptance] Candidate final PR',head:'candidate/acceptance',base:'main',draft:true,body:'Synthetic final-merge gate; do not merge into production.'})
}
const releases = gh('GET','releases')
if (!releases.some((r) => r.tag_name === 'v0.0.1-acceptance')) {
  const parent = gh('GET',`commits/${main}`).parents[0].sha
  gh('POST','releases',{tag_name:'v0.0.1-acceptance',target_commitish:parent,name:'Acceptance fixture release',body:'Synthetic release awaiting manual deployment.',prerelease:true})
}
console.log(JSON.stringify({repo,issues:issues.map((i) => i.number),submissions:submitted.map((p) => p.number),finalPr:final.number,finalDraft:final.draft},null,2))
