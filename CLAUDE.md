# e2e-payload-encryption-starter — Agent Orientation (root)

You're looking at a Quarkus + React reference implementation of **end-to-end encrypted request/response payloads**. This file is the entry point for any AI agent — read it before exploring.

## First-principle goals

1. **AI-readable first.** Every path is predictable; every non-obvious decision is documented in `docs/adr/` or a local `CLAUDE.md`.
2. **Crypto correctness over convenience.** Use vetted JOSE libraries (`jose` on JS, `nimbus-jose-jwt` on Java). Never hand-roll AES, RSA, or JWE.
3. **Bidirectional by design.** Responses are encrypted too. If you add a new endpoint that returns sensitive data, it must encrypt the response back to the caller's public key.
4. **Conventional Commits.** `feat/fix/chore/docs/build/test/refactor(scope): message`.

## How to run

```bash
./scripts/dev.sh           # backend :8080 + frontend :3000 concurrently
```

Or individually:

```bash
cd backend && ./mvnw quarkus:dev    # :8080
cd frontend && npm install && npm start    # :3000
```

Smoke test (no browser):

```bash
cd scripts && npm install && npm run smoke
```

Tests:

```bash
cd backend && ./mvnw verify
cd frontend && npm test -- --watchAll=false && npm run build
cd frontend && npx playwright test
```

## Where things live

- **[`backend/CLAUDE.md`](backend/CLAUDE.md)** — backend conventions (Quarkus, Nimbus JOSE+JWT, key management)
- **[`frontend/CLAUDE.md`](frontend/CLAUDE.md)** — frontend conventions (React, `jose` library, ephemeral key pairs)
- **[`docs/architecture.md`](docs/architecture.md)** — bidirectional JWE flow, layer diagram, mermaid sequence
- **[`docs/api.md`](docs/api.md)** — endpoint reference (JWKS, encrypted loan)
- **[`docs/encryption-explained.md`](docs/encryption-explained.md)** — beginner-friendly walkthrough of hybrid encryption
- **[`docs/glossary.md`](docs/glossary.md)** — jargon dictionary (RSA-OAEP, AES-GCM, JWE, JWKS, AAD, kid)
- **[`docs/adr/`](docs/adr/)** — decision records explaining *why* non-obvious choices were made
- **[`demo/sample-requests/`](demo/sample-requests/)** — `.http` fixtures for the REST endpoints
- **[`scripts/smoke-e2e.mjs`](scripts/smoke-e2e.mjs)** — headless bidirectional roundtrip test

## Adding a new encrypted endpoint

1. Backend:
   - Add a request model to `backend/src/main/java/com/example/model/`
   - Add a resource class to `backend/src/main/java/com/example/resource/`
   - Inject `HybridEncryptionService`; decrypt request, process, encrypt response using the frontend JWK from the `X-Frontend-Public-Key` header
   - Validate AAD timestamp (`±60s`) before processing
   - Never log the decrypted payload
2. Frontend:
   - Add an API call in `frontend/src/services/` — use `hybridEncryptionService.encryptRequest(...)` and `decryptResponse(...)`
   - Never call `fetch` with a plaintext body for this kind of endpoint
3. Docs:
   - Update [`docs/api.md`](docs/api.md) with the endpoint's plaintext request/response shapes
   - Add an ADR to [`docs/adr/`](docs/adr/) if the choice is non-obvious

## What not to do

- **Don't remove AAD timestamp validation.** It's the only replay defense in the POC.
- **Don't send plaintext request bodies** to endpoints under `/api/encrypted/`. That's what the prefix signals.
- **Don't log decrypted payloads.** Log the `kid`, the `nonce`, the request size — never the plaintext content.
- **Don't set `quarkus.http.cors.origins=*`.** CORS is the last wall between the frontend and arbitrary origins.
- **Don't persist the symmetric `encryption.key`** from `application.properties` to any real secret. It's a POC placeholder for the legacy AES-CBC path and is not used by the JWE flow.
- **Don't duplicate the JWE wire format.** If you add a new serialization, you've just forked a well-specified standard. Stick to RFC 7516 compact form.

