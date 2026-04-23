# Getting Started

## Prerequisites

- **Java 17+** — `java --version`
- **Node 18+** — `node --version`
- **Maven** — bundled as `./mvnw` in `backend/`
- **npm** — bundled with Node

## Clone and run

```bash
git clone <your-fork-url>
cd e2e-payload-encryption-starter
./scripts/dev.sh
```

The dev script launches the backend on `:8080` and frontend on `:3000` concurrently. Open http://localhost:3000 in a browser.

## Run individually

### Backend

```bash
cd backend
./mvnw quarkus:dev    # hot-reload dev mode, port 8080
./mvnw test           # unit tests
./mvnw verify         # unit + integration tests
```

Verify the JWKS endpoint:

```bash
curl -s http://localhost:8080/.well-known/jwks.json | jq
```

### Frontend

```bash
cd frontend
npm install
npm start             # dev server on :3000
npm run build         # production bundle
npm test              # jest via react-scripts
npx playwright test   # Playwright E2E (requires backend running)
```

## Try the demo

1. Start both servers via `./scripts/dev.sh`.
2. Open http://localhost:3000.
3. Wait for the status banner: *"Ready — End-to-End Encryption (Frontend: `<kid>`, Backend: `<kid>`)"*.
4. Fill the loan form and click **Submit Encrypted Application**.
5. Open DevTools → Network tab. The request body is a compact JWE string; the `X-Frontend-Public-Key` header contains the frontend JWK.
6. The UI shows the decrypted response.

## Smoke test without the browser

From the repo root:

```bash
node scripts/smoke-e2e.mjs
```

This script generates an ephemeral frontend key pair, fetches the backend JWKS, encrypts a sample loan payload, POSTs it, and decrypts the response — exercising the full bidirectional flow with no browser required.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `./mvnw: permission denied` | Missing execute bit | `chmod +x backend/mvnw` |
| Frontend shows "Backend not available" | Backend not running or CORS misconfigured | `curl localhost:8080/api/encrypted/health`; check `quarkus.http.cors.origins` in `backend/src/main/resources/application.properties` |
| Decryption fails after backend restart | Frontend cached an old backend `kid` | Hard-refresh the frontend (Cmd+Shift+R / Ctrl+Shift+R) — it'll refetch JWKS |
| "Timestamp validation failed" | System clock drift between client and server | Sync clocks (NTP); submit within 60 seconds of loading the page |
| Port 8080 or 3000 already in use | Another process holds the port | `lsof -i :8080` / `:3000`, kill the offender |
| Playwright missing browsers | First-time install | `npx playwright install chromium` inside `frontend/` |

## Next steps

- Read [`architecture.md`](architecture.md) for the full bidirectional flow and layer rules.
- Read [`api.md`](api.md) for endpoint details and JWE format.
- Read [`encryption-explained.md`](encryption-explained.md) for a beginner-friendly walkthrough of how hybrid encryption works.
- Read [`glossary.md`](glossary.md) for a jargon dictionary (RSA-OAEP, AES-GCM, JWE, JWKS, AAD, kid).
- Browse [`adr/`](adr/) for the reasoning behind non-obvious design decisions.
