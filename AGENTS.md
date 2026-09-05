# AGENTS.md — Factory Console

- Product and visual decisions live in `PRODUCT.md` and `DESIGN.md`.
- Keep all source changes inside this project. `D:\projects\salon-wall` and the sibling `factory-skills` directory are read-only integration inputs.
- Never persist or return plaintext credentials. Store only validated environment-variable references.
- All external commands must use the fixed allowlist in `server/services/commands.ts`, `spawn` argument arrays, and `shell: false`.
- Shared API and domain types live in `shared/`.
- Before delivery run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

