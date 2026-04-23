## Summary

<!-- One or two sentences on the what and why. Link the issue if applicable. -->

## Changes

- [ ] ...

## Verification

- [ ] `./mvnw verify` green (if backend touched)
- [ ] `npm ci && npx tsc --noEmit && npm test -- --watchAll=false && npm run build` green (if frontend touched)
- [ ] `scripts/smoke-e2e.mjs` passes against local backend (if crypto path touched)
- [ ] Docs updated (`docs/api.md`, `docs/configuration.md`, or relevant `CLAUDE.md`)
- [ ] ADR added if the decision is non-obvious

## Security checklist (for crypto / endpoint changes)

- [ ] No decrypted payload, private key, or raw JWE logged
- [ ] AAD timestamp validation intact
- [ ] CORS allowlist unchanged (or justified in description)
- [ ] No secret committed to the repo
