# ADR 0001: Hybrid Envelope Encryption (RSA-OAEP-256 + AES-256-GCM)

**Status:** Accepted
**Date:** 2026-04-23

## Context

The payload to encrypt is arbitrary JSON — from a few hundred bytes (loan header) to potentially tens of kilobytes (attached metadata). The choice is between:

1. **Pure symmetric** — shared AES key between frontend and backend. Fast, but key distribution is the hard part, and compromise of one client compromises all.
2. **Pure asymmetric** — encrypt the whole payload with RSA. Simple key distribution (public key via JWKS), but RSA is ~1000× slower than AES and has hard size limits (~190 bytes per operation for 2048-bit RSA-OAEP).
3. **Hybrid envelope** — generate a one-shot AES key per message, encrypt the payload with AES, wrap the AES key with RSA.

## Decision

Use hybrid envelope encryption: **RSA-OAEP-256** to wrap a freshly generated **AES-256-GCM** content encryption key. The combination is exactly what [RFC 7516 JWE compact serialization](https://www.rfc-editor.org/rfc/rfc7516) describes.

## Consequences

- **Positive.** Exactly one RSA operation per direction regardless of payload size; AES-GCM handles the payload at hardware speed. Fintech-grade latency target (~200µs per direction) is achievable.
- **Positive.** Each message gets a fresh AES key, so compromise of a single message's ciphertext doesn't help decrypt others.
- **Positive.** GCM provides integrity: tampering breaks decryption, so we get authentication + encryption in one primitive (AEAD). AAD carries metadata that's integrity-protected but not encrypted.
- **Negative.** More moving parts than a single primitive. Easier to implement incorrectly — we rely on a vetted library (`jose` on the client, `nimbus-jose-jwt` on the server) rather than rolling our own JWE.
- **Negative.** RSA is vulnerable to quantum attacks. If/when post-quantum KEMs mature, the RSA wrap step needs to migrate (Kyber/ML-KEM would drop in). The payload encryption (AES-256-GCM) is post-quantum-safe at symmetric strength.

## Alternatives considered

1. **ECDH-ES + A256GCM.** Elliptic-curve Diffie-Hellman key agreement. Smaller keys, faster than RSA. Rejected for this POC because RSA + `use: enc` JWKs have broader library support; a follow-up ADR can introduce ECDH once the team is comfortable with the JWE primitives.
2. **Signal-style double ratchet.** True forward secrecy per message. Rejected — massive overkill for request/response API encryption, and forces state management the frontend isn't set up for.
3. **Pure TLS with mTLS client certs.** Relies on the TLS terminator not being adversarial; doesn't defend against CDN/proxy logging of plaintext bodies. Complementary to JWE, not a replacement.
