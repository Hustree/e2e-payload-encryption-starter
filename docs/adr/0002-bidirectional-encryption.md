# ADR 0002: Encrypt the Response, Not Just the Request

**Status:** Accepted
**Date:** 2026-04-23

## Context

Many "encrypted API" POCs encrypt only the request payload and return a plaintext JSON response. That's cheaper to build — the frontend never needs its own key pair, and the server doesn't need to parse a JWK from a header.

But it leaves the response body readable by every intermediary: the same CDN, proxy, sidecar, and log collector that the request-side encryption was introduced to defend against. If a loan application's details are sensitive inbound, the approval status and `applicationId` are equally sensitive outbound.

## Decision

Encrypt both directions. The frontend generates an **ephemeral RSA key pair per session** and sends its public key in a request header (`X-Frontend-Public-Key`). The backend uses that public key to encrypt the response to a JWE that only the frontend's private key can decrypt.

Neither key pair is persisted: both sides regenerate on restart (backend) or tab-load (frontend).

## Consequences

- **Positive.** Responses enjoy the same threat model as requests — no plaintext ever visible to intermediaries.
- **Positive.** Per-session frontend key pairs mean even a compromised historical response JWE can't be decrypted by anyone except the original tab that received it.
- **Positive.** The `X-Frontend-Public-Key` header pattern is simple and stateless — the backend doesn't need to track active sessions or keys.
- **Negative.** Frontend must generate an RSA key pair at startup; in Chrome this takes ~50ms on a modern CPU, imperceptible to users.
- **Negative.** The frontend public JWK adds ~400 bytes to every request header. Negligible for JSON APIs, potentially meaningful for very high-frequency calls — consider ECDH (ADR 0001) to shrink keys if this becomes an issue.
- **Negative.** If the user refreshes the page between request and response, the response is undecryptable (the old private key is gone). Mitigated by the fact that responses arrive synchronously with the request — same tab lifetime.

## Alternatives considered

1. **Plaintext responses.** Rejected for the reason above: leaves response bodies visible to intermediaries.
2. **Symmetric session key.** Do one RSA handshake, derive an AES session key, reuse it for all requests and responses in the session. Rejected — larger blast radius if the session key leaks, and we'd need explicit session management on the backend.
3. **Static frontend public key bundled with the frontend build.** Rejected — the key would be discoverable in the JS bundle, and would require frontend rebuilds for rotation.
