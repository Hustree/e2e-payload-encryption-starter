# Security

## Reporting a vulnerability

If you find a security issue, please report it privately.

- Email: `joshuabascos@gmail.com`
- Subject line: `[SECURITY] e2e-payload-encryption-starter: <short description>`

Please do not open a public GitHub issue for vulnerabilities.

Include:

- Affected component (backend crypto, frontend crypto, a specific endpoint or file)
- Steps to reproduce
- Impact assessment, if known
- Suggested fix, if you have one

Expect an acknowledgement within 72 hours and a proposed remediation path within two weeks.

## Supported versions

`main` is the only supported branch. Once a tagged release exists, the two most recent minor versions will be supported for security fixes.

## Known-good security hygiene

This repo ships with:

- **Hybrid JWE encryption** in both directions (RSA-OAEP-256 + AES-256-GCM). No plaintext payload ever crosses the network.
- **AEAD-bound replay protection** via timestamp + nonce in AAD (±60s window). Tampering breaks decryption.
- **Ephemeral per-session frontend keys** — responses can only be decrypted by the exact tab that sent the request.
- **Strict CORS allowlist** — `*` is never the default; production deployments must narrow to their specific frontend origin.
- **CodeQL** scans on PRs and weekly cron (Java + TypeScript).
- **Dependabot** weekly for Maven, npm, and GitHub Actions.
- **No secrets tracked** — `.env*` files are gitignored; `.env.example` holds placeholders only.

## Known limitations (by design — this is a POC)

These are documented here rather than silently shipped:

- **No user authentication.** There is no login, session, or bearer token on `POST /api/encrypted/loan`. Wrap the endpoint with your preferred auth layer (JWT, OIDC, mTLS) in production.
- **No nonce uniqueness store.** A replay within the ±60s window would succeed. For write-heavy endpoints (payment authorization, loan approval that charges), add a Redis-backed nonce store keyed on `{kid, nonce}` with TTL slightly larger than the timestamp window.
- **Hardcoded symmetric key in properties/env.** `encryption.key` / `REACT_APP_ENCRYPTION_KEY` carry a dummy AES-CBC key for the legacy non-JWE demo path. Remove before any non-demo deployment; the JWE flow does not use it.
- **RSA keys live in process memory.** On backend restart the `kid` rotates and in-flight frontend tabs must refetch JWKS. In production, source the RSA key pair from a KMS (AWS KMS, Google Cloud KMS, HashiCorp Vault) and persist across restarts.
- **No rate limiting.** A determined attacker can still exhaust the service with malformed JWEs. Put this behind a rate-limiting reverse proxy.
- **No audit log.** Successful/failed decryption attempts are not persisted. Emit structured logs and forward to SIEM before production use.
- **No post-quantum resistance.** RSA-OAEP is vulnerable to a future cryptographically-relevant quantum computer. AES-256 is PQ-safe at symmetric strength. When ML-KEM (Kyber) matures, migrate the key-wrap step.

## Out of scope

- Denial of service via large request bodies — Quarkus defaults cap input size, but a determined attacker can still exhaust the network. Put the service behind a rate-limiting reverse proxy.
- Side-channel attacks on the underlying crypto primitives — the POC relies on `nimbus-jose-jwt` (Java) and `jose` (JavaScript), both vetted libraries. Vulnerabilities in those libraries should be reported upstream.
