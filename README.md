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

SQLite data lives at `.data/factory-console.sqlite` by default. Override it with `FACTORY_CONSOLE_DB`. Language and selected-project preferences are the only values stored in browser `localStorage`.

Credentials are never entered or persisted as plaintext. Configuration fields accept environment-variable names such as `SALON_WALL_MYSQL_PASSWORD`. Set the actual value in the server process environment, then store only that variable name in Factory Console. The backend reports only whether a reference is configured.

The MVP implements `EnvironmentSecretProvider`. Windows Credential Manager and DPAPI are extension points, not implemented features. Command output is redacted before persistence and response.

## Safe actions

The backend command allowlist contains only:

- `factory doctor`
- `factory review collect <batch>`
- `factory batch start <batch> --prd <path>`

Commands use argument arrays with `shell: false`; there is no arbitrary shell field. Review collection and batch start require a second confirmation and create audit records. The console never merges `main`, creates Tags, performs SSH deployment, or executes generated deployment commands.

## Daily briefs

Each enabled project can schedule a daily brief by local time and IANA timezone. The server checks schedules in-process, generates a local Markdown record, and sends it only when a generic webhook URL and webhook secret environment reference are configured. Manual preview and Markdown export work without notifications.

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

