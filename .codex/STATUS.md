# Factory Console status

## Active goal — 2026-09-05

Create a private GitHub repository and push the current project, then repair and verify the full MVP in this order:

1. Security: read-only status, strict command allowlist, secret references and redaction.
2. Project creation/editing, request isolation, cache correctness.
3. Batch-aware workflow state and actionable task details.
4. Daily reports, complete i18n, responsive and accessible UI.
5. Independent GitHub test repository live acceptance, four checks, and final push.

Original requirements: ../Factory-Console-Codex实现提示词.md. Review findings: REVIEW-2026-09-05.md.

Never modify salon-wall, factory-skills, or global Skills. No superpowers workflow. Do not run the known mutating Factory next as a read operation. Do not publish credentials, local DBs, or private configuration.

Progress: original P1 defects repaired; 53 tests and deterministic Review probes pass. Real isolated GitHub doctor/collect/batch-start and Draft→Ready gate verified. See ACCEPTANCE-2026-09-05.md. Final visual recheck, GitHub push/CI and production-start handoff are being finalized. Baseline REVIEW-2026-09-05.md describes the pre-fix state, not current readiness.
