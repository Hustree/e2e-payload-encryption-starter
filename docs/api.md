# API Reference

Base URL in development: `http://localhost:8080`

All request/response bodies are JSON unless noted. JWE strings appear as compact-serialization (five base64url-encoded parts separated by `.`).

## `GET /.well-known/jwks.json`

Returns the backend's public key set. The frontend calls this at boot and caches the result.

**Response — 200**

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "enc",
      "alg": "RSA-OAEP-256",
      "kid": "2de32220-95a6-476f-8a35-749ba008185f",
      "n": "sQEbnjhhOCC3U0cRrBznGhknFOD...",
      "e": "AQAB"
    }
  ]
}
```

The `kid` (key ID) rotates on every backend restart. Frontends must refetch JWKS if decryption fails with an unknown-kid error.

## `GET /api/encrypted/health`

Unencrypted health probe.

**Response — 200**

```json
{ "status": "UP", "service": "encrypted-loan" }
```

## `POST /api/encrypted/loan`

Submit an encrypted loan application. Request is a JWE of a [`LoanApplication`](../backend/src/main/java/com/example/model/LoanApplication.java) JSON; response is a JWE of the processing result.

**Request headers**

| Header | Required | Purpose |
|---|---|---|
| `Content-Type: application/json` | yes | — |
| `X-Frontend-Public-Key` | yes | Frontend's public JWK — backend uses this to encrypt the response back to the caller |

**Request body**

```json
{
  "jwe": "<compact-JWE string>",
  "aad": {
    "nonce": "b4f6c1e2-...",
    "ts": 1761312450123
  }
}
```

The JWE's plaintext, once decrypted by the backend, is:

```json
{
  "customerId": "CUST-12345",
  "customerName": "Jane Doe",
  "amount": 25000,
  "loanType": "PERSONAL",
  "term": 24,
  "purpose": "Home renovation"
}
```

**Response — 200 (encrypted)**

```json
{
  "encrypted": true,
  "jwe": "<compact-JWE string>"
}
```

Once decrypted by the frontend with its private key, the plaintext is:

```json
{
  "status": "SUCCESS",
  "applicationId": "APP-9f1c...",
  "message": "Application received",
  "processedData": {
    "customerId": "CUST-12345",
    "amount": 25000
  },
  "timestamp": 1761312450567
}
```

**Error responses**

| Status | Condition |
|---|---|
| `400` | Malformed JWE, missing `X-Frontend-Public-Key`, or invalid frontend JWK |
| `400` | AAD timestamp outside ±60s window (replay protection) |
| `400` | JWE decryption failed (wrong kid, corrupted payload, key mismatch after restart) |
| `500` | Unhandled server error — generic message; details in server logs only |

Error bodies never include cryptographic detail, key material, or stack traces.

## JWE headers (protected)

Every JWE produced by either side carries:

```json
{
  "alg": "RSA-OAEP-256",
  "enc": "A256GCM",
  "kid": "<recipient-kid>"
}
```

- `alg` — how the content encryption key was wrapped
- `enc` — how the payload was encrypted
- `kid` — which recipient key was used (backend kid on requests, frontend kid on responses)

## Example — end-to-end via Node (for smoke testing)

See [`demo/sample-requests/`](../demo/sample-requests/) for executable fixtures. A fully working Node roundtrip lives at [`scripts/smoke-e2e.mjs`](../scripts/smoke-e2e.mjs).

```bash
# terminal 1
cd backend && ./mvnw quarkus:dev

# terminal 2
cd scripts && npm install && npm run smoke
```
