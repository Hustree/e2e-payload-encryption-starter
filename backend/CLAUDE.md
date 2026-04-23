# Backend — Agent Orientation

Quarkus 3 + Java 17 + Nimbus JOSE+JWT. Read this file before editing.

## How to run

```bash
./mvnw quarkus:dev           # hot reload on :8080
./mvnw test                  # unit tests
./mvnw verify                # unit + integration tests
./mvnw package -DskipTests   # build jar
```

## Package map — where things live

```
com.example
├── crypto/
│   ├── RSAKeyManager.java            generates the backend RSA key pair at startup
│   ├── HybridEncryptionService.java  JWE encrypt/decrypt via Nimbus JOSE+JWT
│   └── AESCryptoService.java         legacy AES-CBC path (kept for comparison; not used by JWE flow)
├── model/
│   ├── EncryptedPayload.java         wire shape: { jwe, aad { nonce, ts } }
│   └── LoanApplication.java          decrypted domain record
└── resource/
    ├── JWKSResource.java             GET /.well-known/jwks.json
    └── EncryptedLoanResource.java    POST /api/encrypted/loan, GET /api/encrypted/health
```

## Crypto conventions

- **Key wrap:** `RSA-OAEP-256` (RSA 2048-bit with SHA-256 OAEP padding)
- **Content encryption:** `A256GCM` (AES-256 in GCM mode)
- **JWE serialization:** compact form only — five base64url parts joined by `.`
- **AAD:** `{ nonce, ts }` as JSON, validated server-side: `Math.abs(now - ts) <= 60_000`
- **kid:** rotates on every backend restart; frontends must refetch JWKS if an unknown-kid error comes back

## Where keys come from

| Key | How it's obtained | Lifetime |
|---|---|---|
| Backend RSA private key | `RSAKeyManager` generates on startup (in-memory) | Process lifetime |
| Backend RSA public key | Served via `/.well-known/jwks.json` | Process lifetime |
| Frontend RSA public key | Parsed from `X-Frontend-Public-Key` request header (JWK JSON) | Per request |
| Content AES-256 key | Generated fresh by Nimbus per JWE encrypt call | Single message |

For production, swap `RSAKeyManager` for a KMS-backed implementation (AWS KMS, Google Cloud KMS, HashiCorp Vault) — the key material never needs to leave the HSM.

## Adding a new encrypted endpoint (worked pattern)

1. Add a domain record to `model/<Name>.java` — plain Java record for the decrypted shape.
2. Add a resource to `resource/<Name>Resource.java`:
   - `@Path("/api/encrypted/<name>")` + `@Consumes(APPLICATION_JSON)` + `@Produces(APPLICATION_JSON)`
   - Inject `HybridEncryptionService`
   - In the handler: parse `EncryptedPayload` → call `decryptJWEWithValidation(jwe, aad)` → process → call `encryptResponse(result, frontendJwk)` → return `{ encrypted: true, jwe }`
3. Add a unit test and integration test mirroring the existing `EncryptedLoanResource` pattern.
4. Document in [`../docs/api.md`](../docs/api.md).

## Logging conventions

- Declare: `private static final Logger LOG = Logger.getLogger(ClassName.class);`
- **Never log decrypted payloads, private keys, or raw JWE strings at any level.** Log `kid`, `nonce`, byte counts, and outcomes.
- Levels: `infof` for normal flow, `debugf` for dev debugging, `errorf` for unexpected failures (with sanitized context).
- User-controlled strings (customer names, purposes) must not be logged in production — PII risk.

## Test conventions

- Naming: `method_scenario_expectedResult` (e.g. `decryptJWE_expiredTimestamp_throwsAEADValidation`).
- JUnit 5 + Mockito for unit tests.
- REST-Assured for integration: `@QuarkusTest` class + real JWE fixtures produced in `@BeforeAll`.
- Test the failure paths — malformed JWE, wrong `kid`, timestamp outside window, missing header.

## JOSE gotchas

- Nimbus `JWEObject.parse()` only validates the envelope structure. You must explicitly call `.decrypt(decrypter)` — a parsed JWE is not an authenticated one.
- The AAD (`setAdditionalAuthenticatedData`) is not part of the compact JWE string — it's supplied at decrypt time and must match exactly what the encrypter supplied, byte-for-byte. We pass it as `Base64URL`-encoded JSON `{nonce, ts}`.
- When importing a frontend JWK from a header, validate that `kty=RSA`, `use=enc`, `alg=RSA-OAEP-256` before trusting it. An attacker could send a `use=sig` key and attempt confusion attacks.
- Don't catch `Exception` and return a detailed error message — that's an oracle. Catch, log the detail server-side, return a generic `400 Bad Request`.

## Files you should not edit without a good reason

- `pom.xml` — dep version bumps are fine; adding new crypto libraries requires an ADR.
- `application.properties` — adding a property is fine; renaming one breaks consumers.
- `RSAKeyManager` — key lifecycle is subtle. If you need rotation or persistence, raise an ADR first.
