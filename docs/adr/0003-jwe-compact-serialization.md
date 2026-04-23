# ADR 0003: JWE Compact Serialization

**Status:** Accepted
**Date:** 2026-04-23

## Context

We need an on-the-wire format for the encrypted payload. Options:

1. **Custom JSON wrapper.** Something like `{ ciphertext, iv, encryptedKey, authTag, alg }`. Simple to define; nobody else implements it.
2. **JWE JSON serialization.** RFC 7516 defines both a JSON form (verbose, with named fields) and a compact form.
3. **JWE compact serialization.** Five base64url-encoded parts joined by `.`: `header.encryptedKey.iv.ciphertext.authTag`.

## Decision

Use **JWE compact serialization** (RFC 7516 §7.1) for both request and response payloads.

## Consequences

- **Positive.** Any JOSE-compliant library on any language interops without reverse-engineering our wire format: `jose` (JavaScript), `nimbus-jose-jwt` (Java), `jose` (Go), `authlib` / `python-jose` (Python), `josekit` (Rust), etc.
- **Positive.** Compact form is ~20% smaller than the JSON form. For JWE-in-header scenarios (not used here but likely future), the compact form is the only option — `.` is URL-safe, unlike JSON.
- **Positive.** The protected header is integrity-protected via AAD, so `kid` and `alg` can't be tampered with mid-flight.
- **Negative.** Base64url encoding adds ~33% overhead vs raw bytes. Negligible for JSON payloads that are already text.
- **Negative.** Debugging tools like JWT.io handle JWS/JWT but not JWE (JWE requires the recipient private key to decrypt, which debuggers can't have). In-browser DevTools + backend logs are sufficient.

## Alternatives considered

1. **Custom JSON wrapper.** Rejected — every integration partner would need custom client code. JWE interop is the point.
2. **JWE JSON serialization.** Verbose (~20% larger), and no advantage for our use case. The compact form is canonical for transport.
3. **PASETO.** Modern alternative to JOSE with fewer footguns. Rejected — library ecosystem is sparse compared to JOSE, especially in Java/Quarkus.
4. **CBOR Web Encryption (COSE/CWE).** Binary-friendly JWE cousin. Rejected — JSON APIs over HTTP don't benefit; COSE shines in constrained-device contexts.
