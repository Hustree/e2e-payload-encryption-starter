# Frontend JSON Encryption – PRD (React + .NET 8)

**Product:** React + .NET 8 API  
**Feature Type:** Security / Data Protection  
**Author:** Joshua Bascos  
**Date:** 2025-09-24

---

## PRD Prompt

HELP ME MAKE A PRD FOR AN MVP FEATURE FOR FRONTEND JSON ENCRYPTION & BACKEND DECRYPTION USING A HYBRID JWE APPROACH.

I’M LOOKING TO CREATE A POC FOR SUBMITTING ENCRYPTED DATA TO AN API FROM A FRONT-END REACT APPLICATION.

THE GOAL: ENSURE DATA SECURITY BY ENCRYPTING JSON PAYLOADS IN THE FRONT-END AND DECRYPTING THEM SAFELY IN THE BACKEND BEFORE PROCESSING.

WE SHOULD THINK THROUGH:
1. HOW TO ENCRYPT JSON PAYLOAD IN REACT (Hybrid: RSA-OAEP-256 for key wrapping + AES-256-GCM for content).  
2. HOW TO SAFELY TRANSMIT ENCRYPTED DATA TO THE API (JWE compact serialization + HTTPS + strict CORS).  
3. HOW TO DECRYPT DATA SECURELY IN .NET 8 BACKEND (Clean Architecture + JOSE/JWE with RSA private key; return response encrypted to frontend’s ephemeral key).  
4. HOW TO HANDLE KEY MANAGEMENT (JWKS for backend public key; per-session frontend RSA key; rotation).  
5. HOW TO ENSURE PERFORMANCE DOESN’T DROP SIGNIFICANTLY (envelope encryption: 1 RSA op per direction; AES-GCM for payload).  
6. HOW TO SUPPORT FUTURE EXTENSIONS (key rotation, idempotency, OAuth2/JWT, rate limiting, ProblemDetails, metrics).

And then put text: “EXAMPLE PRD LINKED IN DESCRIPTION.”

---

## Functional Requirements Table

| Requirement ID | Description | User Story | Expected Behavior/Outcome |
|---|---|---|---|
| FR001 | JSON Payload Encryption | As a developer, I want to encrypt JSON data on the frontend so sensitive info isn’t exposed in transit. | Frontend uses JWE (RSA-OAEP-256 + AES-256-GCM) to encrypt data before sending to API. |
| FR002 | API Accepts Encrypted Data | As a backend service, I want to accept encrypted JSON payloads so only decrypted data is processed. | API endpoint validates and decrypts payload before saving/using. |
| FR003 | Backend Decryption | As a backend developer, I want to decrypt data securely so I can process original JSON. | .NET 8 backend decrypts JWE using private key, validates AAD (nonce + timestamp), maps to DTOs. |
| FR004 | Key Management | As a system, I want secure handling of encryption keys so attackers cannot compromise payloads. | Backend exposes JWKS; frontend generates ephemeral RSA pair; rotate keys safely. |
| FR005 | Error Handling | As a developer, I want clear error handling if decryption fails so issues can be debugged. | ProblemDetails responses with correlation ID; never leak sensitive info. |
| FR006 | Performance | As a user, I want encryption to be fast so my app doesn’t lag. | Envelope encryption achieves <200ms perceived latency; compact JWE reduces payload size. |
| FR007 | POC Demo | As a stakeholder, I want a working proof-of-concept so we can evaluate feasibility. | Demo: React form → encrypt JSON → send to API → decrypt → re-encrypt response to frontend → display. |

---

## Data & Detection Notes

- Payloads structured in JSON (e.g., loan applications).  
- Encryption algorithms:  
  - RSA-OAEP-256 (key encryption), AES-256-GCM (content).  
  - JWE Compact Serialization as the transport format.  
- Backend: .NET 8 Web API (Clean Architecture with Application/Infrastructure layering).  
- Keys: Backend publishes JWKS; frontend generates ephemeral RSA key pair; never hardcode secrets in frontend.  
- AAD: `{ nonce: string, ts: number }` for anti-replay; validate timestamp (±60s) server-side.  

---

## UX / UI

- Frontend Form: React form with fields (e.g., Name, Amount, Term).  
- Encryption Step: On submit, data is encrypted in-browser (JWE) before hitting API.  
- API Call: Sends `{ jwe: string, aad: { nonce, ts } }` with header `X-Frontend-Public-Key: <frontend JWK>` (kid/use/alg).  
- Backend Flow: Decrypt request → validate AAD → process → encrypt response to frontend public key → return JWE.  
- Demo UI: Show both encrypted request and decrypted response in a debug panel.

---

## Architecture (JB Dev Guidelines)

- Layers: API (Controllers) → Application (Interfaces/Orchestrators) → Infrastructure (Implementations/JOSE, Repos).  
- Feature-first slices: `Features/Loans/...` encapsulate contracts and handlers.  
- DTOs: Use C# records for request/response DTOs.  
- Validation: FluentValidation at the edge (request validators).  
- Errors: Standardize with ProblemDetails; include correlation ID.  
- Swagger/OpenAPI: Doc request/response and error shapes; JWT security scheme ready.  
- Security: HTTPS/HSTS; JWT bearer; strict CORS; headers (`X-Content-Type-Options`, `Referrer-Policy`, CSP, `Permissions-Policy`).  
- Dapper (ready): If persistence is added, use parameterized SQL, transactions per unit-of-work.

---

## Implementation Overview (Current Frontend + Planned .NET Backend)

### Frontend (React + TypeScript)
- Library: `jose` v5.x.  
- JWKS: Fetch backend key at `/.well-known/jwks.json`.  
- Request: Build compact JWE with header `{ alg: RSA-OAEP-256, enc: A256GCM, kid }`.  
- AAD: Include `{ nonce, ts }`.  
- Response: Decrypt compact JWE using frontend private key (ephemeral pair generated via WebCrypto).  
- File reference: `frontend/src/services/hybridEncryptionService.ts`.

### Backend (Planned: .NET 8 Web API)
- Publish JWKS: `GET /.well-known/jwks.json` (RSA public key, `use: enc`, `alg: RSA-OAEP-256`, `kid`).  
- Endpoint: `POST /api/v1/encrypted/loan` accepts `{ jwe, aad }` and header `X-Frontend-Public-Key`.  
- Decrypt: Parse compact JWE, unwrap AES via RSA private key, decrypt payload with AES-256-GCM.  
- Validate: AAD timestamp within ±60s; nonce uniqueness optional via store.  
- Process: Map to `LoanApplication` record; apply validation; return result DTO.  
- Encrypt Response: Import frontend JWK; encrypt response JSON to JWE with `kid = frontend-kid`.  
- Errors: Return `application/problem+json` with correlation ID.

---

## API Design (Versioned, RESTful)

- `GET /.well-known/jwks.json` → 200 OK `{ keys: [...] }`  
- `GET /api/v1/encrypted/health` → 200 OK  
- `POST /api/v1/encrypted/loan`  
  - Request headers:  
    - `Content-Type: application/json`  
    - `X-Frontend-Public-Key: <JWK>`  
    - `X-Correlation-ID: <guid>` (optional; generate if missing)  
  - Request body: `{ jwe: string, aad: { nonce: string, ts: number } }`  
  - Responses:  
    - 201 Created: `{ jwe: string }` (encrypted response)  
    - 400 Bad Request: ProblemDetails  
    - 401/403: ProblemDetails  
    - 429: ProblemDetails  
    - 500: ProblemDetails (generic message)

---

## Sample DTOs (C# Records)

```csharp
public sealed record EncryptedPayload(string jwe, AAD aad);
public sealed record AAD(string nonce, long ts);

public sealed record LoanApplication(
    string CustomerId,
    string? CustomerName,
    decimal Amount,
    string? LoanType,
    int? TermMonths
);

public sealed record LoanResponse(
    string Status,
    string ApplicationId,
    string Message,
    DateTimeOffset Timestamp
);
```

---

## Validation (FluentValidation)

- Reject missing/invalid `nonce` or `ts`.  
- Enforce `ts` window ±60s configurable.  
- Validate `LoanApplication` (required `CustomerId`, `Amount > 0`, reasonable limits).  
- Content limits: JSON size cap to prevent abuse.

---

## Error Handling (ProblemDetails)

- Use RFC 7807: `application/problem+json`.  
- Include `traceId`/correlation ID.  
- Map known failures:  
  - Invalid JWE → 400.  
  - Timestamp/nonce invalid → 400.  
  - Missing `X-Frontend-Public-Key` → 400.  
  - Decryption failure → 400 with safe message.  
- Do not leak cryptographic detail.

---

## Security & Compliance

- HTTPS-only; HSTS.  
- Strict CORS: allow trusted frontend origin(s) only.  
- JWT Bearer (future): policy-based authorization.  
- Secrets from config/secret vault; never in code.  
- Logging: structured, redact sensitive values; never log JWE or keys.  
- Headers: `X-Content-Type-Options=nosniff`, `Referrer-Policy=no-referrer`, CSP, `Permissions-Policy`.  
- Rate limiting (per-IP) and spike arrest for POST.  
- Idempotency: support `Idempotency-Key` on POST when writing to storage.

---

## Dev & Ops

- Observability: request logging with durations; metrics around decrypt/encrypt timings.  
- Swagger/OpenAPI: XML comments on controllers; define JWT security scheme.  
- Testing: unit (validators, orchestrators), integration (JWE decrypt/encrypt), contract (controllers), E2E (form → API).  
- CI: analyzers, SCA, tests as quality gates.

---

## Frontend–Backend Sequence (Planned)

1. Frontend starts → generates frontend RSA key pair; fetches backend JWKS; caches backend `kid`.  
2. User submits form → frontend creates compact JWE with header `{ alg: RSA-OAEP-256, enc: A256GCM, kid }` and body plaintext = JSON.  
3. Frontend sends `{ jwe, aad }` with header `X-Frontend-Public-Key: <frontend JWK>`.  
4. Backend decrypts JWE (private key), validates AAD (nonce, timestamp), processes domain logic.  
5. Backend encrypts response JSON using the received frontend JWK; returns `{ jwe }`.  
6. Frontend decrypts response using its private key; renders result.

---

## Runbook (Local Dev)

- Backend (.NET 8): scaffold API with Clean Architecture; expose `/api/v1/encrypted/loan` and `/.well-known/jwks.json`.  
- Frontend (React): `npm ci && npm start`; ensure backend CORS allows `http://localhost:3000`.  
- Postman/cURL: prefer real frontend-generated JWE for testing; cannot fabricate easily.

---

## Open Items / Next Steps

- Implement .NET 8 JWKS + JWE decrypt/encrypt endpoints per above design.  
- Wire FluentValidation and ProblemDetails middleware.  
- Add correlation ID middleware and structured logging.  
- Add basic rate limiting and request size limits.  
- Add unit/integration tests for JWE paths.

---

## “EXAMPLE PRD LINKED IN DESCRIPTION.”
