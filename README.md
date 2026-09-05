# Factory Console

Factory Console is a local-first, multi-project control surface for the Factory Skills workflow. It reads real Git, GitHub CLI, and per-project Factory state, highlights human gates, runs a fixed set of guarded commands, generates daily briefs, and stores only non-sensitive configuration plus redacted audit logs.

## Requirements

- Node.js 22+
- Git
- Git Bash on Windows for project Factory scripts
- Optional: authenticated `gh` CLI for GitHub Issues, PRs, reviews, Tags, and Releases

## Start

```powershell
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The Vite server proxies `/api` to the Express server at <http://127.0.0.1:8787>.

Production build and local server:

```powershell
npm run build
npm start
```

Open <http://127.0.0.1:8787>.

## Add a real project

Open **Projects / 项目**, choose **Add Project / 新增项目**, and enter an absolute local repository path. GitHub repository can be left blank when `origin` is a GitHub URL. Factory and PRD paths are always project-relative, with defaults `scripts/factory/factory` and `docs/prd.md`.

The console does not edit a configured project's source files during status reads. Git status uses local tracking references and does not run `git fetch` automatically.

## Local data and secrets

SQLite data lives at `.data/factory-console.sqlite` by default. Override it with `FACTORY_CONSOLE_DB`. Only language, selected project ID and current page preferences are stored in browser `localStorage`. Configuration, schedules, reports and redacted run records survive restarts. Deleting a project removes its reports and command logs but retains minimal CRUD audit events.

Credentials are never entered or persisted as plaintext. Configuration fields accept environment-variable names such as `SALON_WALL_MYSQL_PASSWORD`. Set the actual value in the server process environment, then store only that variable name in Factory Console. The backend reports only whether a reference is configured.

The MVP implements `EnvironmentSecretProvider`. Windows Credential Manager and DPAPI are extension points, not implemented features. Command output is redacted before persistence and response.

For Webhook delivery, `notification.target` must be an environment-variable **name**, for example `MY_PROJECT_WEBHOOK_URL`; its server-side value is the full private URL. Optional `webhookSecretRef` names a variable containing a Bearer credential. Never enter either plaintext value in the UI. `.env.example` is documentation only: the server does not automatically load `.env`; provide environment variables to the process using your preferred secure mechanism. Legacy database records containing plaintext Webhook targets are cleared on startup and must be reconfigured with references.

## Safe actions

The backend command allowlist contains only:

- `factory doctor`
- `factory review collect <batch>`
- `factory batch start <batch> --prd <path>`

Commands use argument arrays with `shell: false`; there is no arbitrary shell field. Review collection and batch start require a second confirmation and create audit records. The console never merges `main`, creates Tags, performs SSH deployment, or executes generated deployment commands.

The supplied Factory `next` can invoke `collect --apply`. To honor the default-read-only contract, the console calls only `factory status` and derives NEXT from GitHub evidence, marking machine fields `SOURCE=console-readonly`. It is not claiming to execute upstream `next`. Reads never invoke fetch or collect. Only configure trusted project scripts; arbitrary third-party script contents are not sandboxed.

`batch start` fetches remote state, switches the local default branch, creates/reuses branches and the milestone, and assigns **all open todo/doing/review Issues** to the selected batch, including existing milestone reassignment. `review collect` updates decision labels, Issue status and the batch review dashboard; it does not promote code. These effects are described before confirmation. Doctor has a 60-second limit; mutating commands have a 180-second limit. Failures/timeouts preserve the exit code and output; partial remote changes are possible and are not rolled back. Check Run History and remote state before manually retrying. The console never automatically retries writes.

The HTTP service binds to loopback only and validates Host, Origin and JSON content type. This is a single-user desktop service, not an authenticated public/multi-user server. Run one process per database.

## Daily briefs

Each enabled project can schedule a daily brief by local time, IANA timezone and report language. The in-process scheduler checks every 30 seconds, catches up later the same local day after restart, and persists at most one scheduled report per project/local date. It requires the application to remain running; it does not install Windows Task Scheduler or backfill earlier days. The report is saved **before** delivery, and a failed send retains the Markdown and delivery error. Delivery failures are not automatically retried; manual sending generates a fresh report. Manual previews can be repeated and exported as Markdown.

Yesterday's completions use the project's local calendar date, including DST. Current queues are milestone/batch-aware and distinguish ordinary development, rework, review, promotion, candidate P0/P1 evidence, ready final PRs, unreleased main commits and undeployed releases. Candidate evidence uses `*-<batch>-testcases.md` files and `### TC-` cases with `Priority`/`优先级` and `Result`/`执行结果`. Passing results are `PASS`, `PASSED`, `通过` or a leading check mark; missing/negative results remain pending. A Release is considered deployed only when its body has a line starting with `已上线` (optional check mark) or `<!-- factory:deployed -->`.

Generic Webhook delivery posts JSON `{ "text": "<Markdown>" }`, uses a 15-second timeout and refuses redirects. No notification is sent without a configured URL reference. Real third-party mobile delivery still requires the user's endpoint and acceptance; tests use a real local HTTP receiver only. Saved reports and raw redacted CLI output retain their original language; UI labels and freshly generated previews switch locale. GitHub titles/comments are user data, not machine-translated UI copy.

## Real mode and demo mode

Real mode is always the default and is the only mode implemented in this MVP. Unavailable tools, missing scripts, unauthenticated GitHub CLI, and network errors are displayed explicitly. No fake data is substituted. A future demo mode must be opt-in and visibly marked.

## Quality commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Tests use temporary Git repositories and fake gh/factory processes. They never write to a configured real repository or GitHub account.

Additional deterministic regression probes: `node .codex/review/repro.mjs` after build. The historical `.codex/review/serve.mjs` uses old fake responses and is not live acceptance evidence.

The separately authorized, opt-in `.codex/acceptance/` harness is **not** part of `npm test` or CI. It targets only the private `LQY-920/factory-console-acceptance` repository. `setup.mjs --create-fixtures` writes synthetic GitHub fixtures; `serve.mjs` uses `.data/acceptance/console.sqlite` on port 8788 with scheduling disabled; `live.mjs` reads/asserts state and generates local previews; `--exercise-actions` additionally runs confirmed doctor/collect in that test repository. Clone that test repository to `.data/acceptance/repo` before using the harness. Its original fixture check expects PR #9 to be Draft; use `--ready` once it is Ready. See `.codex/ACCEPTANCE-2026-09-05.md` for the actual final-state evidence.

## MVP boundaries

- MySQL and deployment settings are stored and ENV references checked; no MySQL login, SSH connectivity, application deployment, DPAPI or Credential Manager implementation is claimed.
- No automatic PRD-to-Issue generation, coding agent, promotion, final merge, tag creation or knowledge-base writeback. The console presents evidence and human actions; Factory/GitHub remain the execution surfaces for these gates.
- No demo data is substituted, no background service is installed, and no public hosting/authentication is provided. Network outages explicitly degrade state; larger repositories may take longer while paginated evidence is read.
- Start with a small real batch, inspect each confirmation, and keep main merge/release/deployment manual.
