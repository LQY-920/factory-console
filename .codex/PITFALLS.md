# Factory Console Pitfalls

## 2026-09-05 — Review: green baseline tests are not MVP acceptance

- Full findings and reproduction steps: [REVIEW-2026-09-05.md](REVIEW-2026-09-05.md).
- Confirmed: optional secret references serialized as empty strings cause project-create HTTP 400; inherited action keys bypass confirmation; plaintext webhook targets round-trip; Factory status does not pass configured secrets to redaction; task counts misclassify review/testing/rework/release states.
- The real Factory `next` implementation can call `collect --apply` in clean batch mode. Do not invoke this in a default read-only status/preview/scheduler path. This was checked statically; no real mutation was triggered during review.
- Two additional regression tests currently fail: stale project A responses replace selected project B status; saving the current project clears status without reloading. They remain in `.codex/review/state.test.tsx` and are run through the dedicated config, not the existing default test glob.
- Browser confirms create failure, post-save loading, untranslated generated reports, clipped mobile pipeline legend, and incomplete dialog keyboard behavior.
- Product fixes have not been implemented in this review turn. Do not claim safe production readiness from the existing 18 passing tests.
- Review fixture scripts initially needed explicit Node imports to meet the repository ESLint configuration; corrected within review-only files and lint re-run successfully.

## 2026-09-05 — Express 5 catch-all route syntax

- Symptom: the production server crashed at startup with `Missing parameter name at index 1: *`.
- Cause: Express 5's route parser no longer accepts the Express 4 style `app.get('*', ...)` SPA fallback.
- Resolution: use a regular-expression fallback that explicitly excludes `/api` routes.
- Prevention: production-start smoke testing is required after `npm run build`; API-only tests do not load the static client branch.

## 2026-09-05 — CLI child-process trees can outlive direct timeouts

- Symptom: a Factory status read stayed in the loading state while an internal GitHub request was unreachable.
- Cause: terminating the direct Bash process does not guarantee that inherited child-process pipes close immediately on Windows.
- Resolution: each external adapter now has an overall response deadline, and concurrent status requests for one project share a single in-flight promise with a short cache.
- Prevention: unavailable external tools must degrade within a bounded first-paint budget even when their process tree is slow to release.
