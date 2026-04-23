# Contributing

Thanks for your interest. This repo is a reference implementation, but patches are welcome.

## Ground rules

- Be respectful. Disagreements are about code, not people.
- Assume good intent. Ask before rewriting.
- Keep changes focused. Small PRs land faster.

## Workflow

1. Fork the repo.
2. Create a topic branch from `main`: `git checkout -b feat/short-name`.
3. Make your changes. Follow the conventions in the nearest `CLAUDE.md` (root, `backend/`, or `frontend/`).
4. Run the local checks before opening the PR:

   ```bash
   cd backend && ./mvnw verify
   cd ../frontend && npm ci && npm test -- --watchAll=false && npm run build
   ```

5. Open a PR against `main`. Fill out the PR template.

## Commit messages

Conventional Commits: `type(scope): message`. Types:

- `feat` — new capability
- `fix` — bug fix
- `refactor` — no behavior change
- `docs` — documentation only
- `build` — build system or dependencies
- `test` — tests only
- `ci` — CI config
- `chore` — housekeeping

Scopes: `backend`, `frontend`, `crypto`, `api`, `docs`, `ci`. Multiple scopes allowed.

## Scope guidelines

- One topic per PR. A PR adding a feature shouldn't also refactor unrelated code.
- Non-obvious design choices require an ADR under [`docs/adr/`](docs/adr/).
- New endpoints require updates to [`docs/api.md`](docs/api.md).
- Changes to the JWE wire format are breaking — coordinate with all consumers and note in the PR description.

## What not to do

- Don't weaken the replay protection (timestamp/AAD checks).
- Don't commit a real encryption key or private JWK to the repo. `.env*` files are gitignored; use `.env.example` for placeholders.
- Don't log decrypted payloads or key material at any level. Redact in structured logs.
- Don't set `quarkus.http.cors.origins=*` — CORS is the last wall between the frontend and arbitrary origins.
- Don't force-push `main`.

## Review

One approving review is required. Status checks (`backend-ci`, `frontend-ci`, `codeql`) must be green. Maintainer merges after review.

## Releases

Tags follow semantic versioning once the project has a stable public API. Until then, `main` is the only supported branch.
