# Frontend — Agent Orientation

React 19 + TypeScript + Create React App (`react-scripts`) + `jose` library + axios + Playwright. Read this file before editing.

## How to run

```bash
npm install          # once
npm start            # :3000 — requires backend running on :8080
npm run build        # production bundle
npm test             # jest via react-scripts
npx playwright test  # Playwright E2E (requires backend running)
```

## Folder map

```
frontend/
├── public/                         static shell (index.html, favicon, manifest)
├── src/
│   ├── index.tsx                   entry → mounts <App/>
│   ├── App.tsx                     shell
│   ├── components/
│   │   └── LoanApplicationForm.tsx form + submit + render decrypted result
│   └── services/
│       ├── hybridEncryptionService.ts   JWE encrypt/decrypt via `jose` library
│       └── encryptionService.ts         legacy AES-CBC path (kept for comparison)
├── tests/
│   └── encryption-e2e.spec.ts      Playwright bidirectional flow test
└── .env.example                    REACT_APP_API_URL, REACT_APP_ENCRYPTION_KEY (placeholders)
```

## Crypto conventions

- **Library:** `jose` (v5+). Never hand-roll AES, RSA, or JWE — always go through `jose`.
- **Key wrap:** `RSA-OAEP-256`
- **Content encryption:** `A256GCM`
- **Frontend key pair:** generated fresh per tab via `generateKeyPair('RSA-OAEP-256', { extractable: true })`. Cached in the `HybridEncryptionService` singleton for the tab's lifetime.
- **Never send plaintext** to endpoints under `/api/encrypted/`. The prefix signals the contract.
- **Never hardcode a backend public key** in the JS bundle. Fetch from `/.well-known/jwks.json` at boot.

## The service module pattern

`hybridEncryptionService.ts` exposes:

- `initializeKeys()` — generates the frontend RSA key pair and fetches the backend JWKS. Call once at app boot.
- `encryptRequest(data)` — returns `{ jwe, aad }` to send as the POST body.
- `decryptResponse(encryptedResponse)` — takes the backend's `{ encrypted: true, jwe }` and returns the plaintext object.
- `getFrontendPublicJWK()` — returns the JWK to send in the `X-Frontend-Public-Key` header.

Wrap all encrypted API calls through this service. Don't import `jose` directly from components.

## Adding a new encrypted API call

1. In `services/<name>Service.ts`:
   - Import the encryption service
   - Call `encryptRequest(requestData)` to get `{ jwe, aad }`
   - POST with `X-Frontend-Public-Key: JSON.stringify(getFrontendPublicJWK())` and body `{ jwe, aad }`
   - On 2xx, call `decryptResponse(responseBody)` — the plaintext shape is your return type
2. In the component, await the service function and render the plaintext result.
3. Never render or log the raw JWE in production — it doesn't leak plaintext, but it does leak traffic patterns.

## React Scripts quirks

- This project uses CRA (`react-scripts@5.0.1`), not Vite. Env vars must be prefixed `REACT_APP_*` to be exposed to the browser.
- `npm test` runs jest in watch mode by default. Use `npm test -- --watchAll=false` in CI and for one-shot runs.
- No TypeScript path aliases configured — use relative imports.

## Testing conventions

- **Jest/RTL** (unit): `*.test.tsx` next to the code. See `App.test.tsx` for the pattern.
- **Playwright** (E2E): `tests/*.spec.ts`. `playwright.config.ts` auto-starts the frontend dev server; **you must start the backend separately** before running E2E (or adjust `webServer` in the config to start both).
- Write E2E that exercises the full bidirectional flow — encrypted submit, decrypted render.

## Gotchas

- **Page refresh loses the frontend private key.** A response in flight when the user refreshes becomes undecryptable. This is acceptable — responses arrive synchronously with requests.
- **Backend restart rotates the backend `kid`.** The frontend caches the backend public key by kid; if decryption fails with "unknown kid", the frontend must refetch `/.well-known/jwks.json`. `HybridEncryptionService` should handle this transparently on next submit.
- **`extractable: true`** is required when generating the frontend key pair — we need to export the public key to JWK for the header. The private key stays in memory and is never extracted, so the security impact is negligible.

## Files you should not edit without a good reason

- `package.json` scripts — `react-scripts` builds assume the default layout.
- `tsconfig.json` — CRA controls most of the options; overriding can break the build.
- `services/hybridEncryptionService.ts` — core encryption module. Any change here requires a test covering happy path + kid-rotation recovery + response-decryption.
