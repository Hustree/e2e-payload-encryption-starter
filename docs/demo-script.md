# End-to-End Hybrid Encryption: Short Demo Script

## What This Demonstrates
- Request: Frontend encrypts with Backend public key (JWE: RSA-OAEP-256 + AES-256-GCM)
- Response: Backend encrypts with Frontend public key; Frontend decrypts locally
- Anti-replay via AAD timestamp; key IDs (`kid`) for rotation

## Prerequisites
- Java 17, Node 18+
- Ports: Backend `8080`, Frontend `3000` (auto: 3000/3001/3002)

## 1) Start Services
```bash
cd backend && ./mvnw quarkus:dev
# New terminal
cd frontend && npm install && npm start
```

Verify backend JWKS:
```bash
curl http://localhost:8080/.well-known/jwks.json | jq
```

## 2) Frontend Flow (End-to-End)
1. Open `http://localhost:3000`
2. Wait for status: "Ready - End-to-End Encryption (Frontend: <id>, Backend: <id>)"
3. Fill the loan form and click "Submit Encrypted Application"
4. Observe:
   - Network tab: request body is compact JWE; header `X-Frontend-Public-Key` contains frontend JWK
   - Console: request encrypted → response received encrypted → response decrypted
   - UI shows decrypted JSON with `applicationId`

## 3) Under the Hood (Sequence)
1) Frontend
- Generates frontend RSA key pair (for response decryption)
- Fetches backend JWKS; imports backend enc key (`kid`)
- Encrypts form JSON → JWE (RSA-OAEP-256 + A256GCM)
- Sends body `{ jwe, aad:{nonce, ts} }` with header `X-Frontend-Public-Key: <frontend JWK>`

2) Backend
- Decrypts request JWE using backend private key
- Validates AAD timestamp (±60s)
- Processes loan; produces response JSON
- Imports frontend public JWK from header; encrypts response to JWE (kid = frontend key)
- Returns response as `text/plain` JWE (or `application/jose`)

3) Frontend
- Decrypts response JWE using frontend private key
- Renders decrypted result

## 4) Quick API Checks (curl)

Health:
```bash
curl http://localhost:8080/api/encrypted/health | jq
```

JWKS:
```bash
curl http://localhost:8080/.well-known/jwks.json | jq
```

Note: Posting a request with curl requires a valid JWE plus a valid `X-Frontend-Public-Key` header. Generate both from the running frontend (Network tab → copy request payload and header values from the real submission) and replay with curl if needed.

## 5) What to Show in a Live Demo
- Status banner with both key IDs
- Browser Network panel:
  - Request payload: compact JWE string
  - Request header: `X-Frontend-Public-Key` (frontend JWK, `alg: RSA-OAEP-256`, `use: enc`, `kid`)
  - Response body: compact JWE string
- Console logs: encryption → decryption messages on both sides
- Backend logs: request decrypted, response encrypted, application ID

### Files to Open (Encrypt → Decrypt)
- Frontend – Request Encrypt + Response Decrypt:
  - `frontend/src/services/hybridEncryptionService.ts`
    - `encryptRequest(data)` → builds JWE for request using backend public key
    - `decryptResponse(encryptedResponse)` → decrypts JWE response using frontend private key
  - `frontend/src/components/LoanApplicationForm.tsx`
    - Submits `{ jwe, aad }` and sends `X-Frontend-Public-Key` header; receives JWE response

- Backend – Request Decrypt + Response Encrypt:
  - `backend/src/main/java/com/example/resource/EncryptedLoanResource.java`
    - `submitJWELoan(...)` → decrypts request (via service), parses `X-Frontend-Public-Key`, encrypts response
  - `backend/src/main/java/com/example/crypto/HybridEncryptionService.java`
    - `decryptJWEWithValidation(jwe, aad)` → decrypts incoming JWE + timestamp check
    - `parseFrontendPublicKey(jwkJson)` → parses frontend JWK from header
    - `encryptResponse(responseData, frontendPublicKey)` → returns compact JWE response

## 6) Troubleshooting (Fast)
- Keys mismatch after backend restart: Hard refresh frontend (Cmd+Shift+R)
- Timestamp failed: verify system clock; submit within 60s
- CORS: ensure only Quarkus CORS config is used (no manual headers)

## 7) FAQ: Can I "paste to a website" to decrypt like JWT.io?
- JWT.io focuses on JWS/JWT, not JWE. There isn’t a widely trusted public JWE web debugger equivalent because JWE requires access to the recipient private key.
- Recommended approach for demos:
  - Show decryption inline in your app (already implemented)
  - Or use local scripts with `jose` (Node) or `nimbus-jose-jwt` (Java) where you control private keys

Example (Node + jose) to decrypt a JWE if you have the recipient private key:
```bash
node -e "(async()=>{const {compactDecrypt,importJWK}=await import('jose');
 const jwe=process.argv[1];
 const jwk=JSON.parse(process.argv[2]);
 const key=await importJWK(jwk,'RSA-OAEP-256');
 const {plaintext}=await compactDecrypt(jwe,key);
 console.log(new TextDecoder().decode(plaintext));})();" \
  '<PASTE_JWE_HERE>' \
  '{"kty":"RSA","n":"...","e":"AQAB","d":"...","p":"...","q":"...","dp":"...","dq":"...","qi":"...","alg":"RSA-OAEP-256"}'
```

## 8) Key Points to Emphasize
- No plaintext leaves the browser or backend
- Two distinct directions/keys: request (→ backend), response (→ frontend)
- Envelope encryption = 1 RSA op per direction; AES-GCM for content
- JWKS + header JWK enable rotation and zero secret sharing

---

This script is optimized for a concise live demo of full bidirectional (request + response) encryption with clear artifacts to show in browser and logs.


