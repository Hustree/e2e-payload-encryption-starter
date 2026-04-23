# ADR 0004: AAD-Based Timestamp + Nonce Replay Protection

**Status:** Accepted
**Date:** 2026-04-23

## Context

Encryption alone doesn't stop an attacker who captures an encrypted message from replaying it verbatim later. If the server decrypts "approve $25,000 loan for CUST-12345" once, the ciphertext is valid forever unless we add a freshness check.

Options:

1. **Do nothing.** Accept replay risk.
2. **Strict nonce uniqueness.** Keep a store of every nonce seen; reject repeats. Strong but stateful and requires coordination across backend instances.
3. **Timestamp window.** Reject messages older than a few minutes; accept the small window as the replay risk.
4. **Timestamp window + nonce uniqueness within the window.** Belt-and-braces; nonce store only needs to hold messages from the last N seconds.

## Decision

Ship option (3) — **timestamp window of ±60 seconds** — validated server-side. The timestamp and a random nonce live in a JWE AAD block, so tampering breaks decryption (AEAD authentication).

Leave option (4) — nonce uniqueness store — documented as a production hardening step in `SECURITY.md`, not implemented in the POC.

## Consequences

- **Positive.** Stateless backend; any instance can process any message. No cross-instance coordination needed.
- **Positive.** AAD cryptographically binds `{ nonce, ts }` to the ciphertext. An attacker can't replay with a new timestamp — the auth tag verification would fail.
- **Positive.** 60 seconds is short enough to defeat convenience replays, long enough to tolerate clock drift and slow networks.
- **Negative.** A sufficiently fast replay within 60 seconds succeeds. For this POC — loan applications are idempotent by business ID — that's acceptable. For payment authorization or similar, add the nonce store (option 4).
- **Negative.** Clock skew between client and server matters. NTP-synced systems stay well within 60s; misconfigured VMs can fail.

## Alternatives considered

1. **No replay protection.** Rejected — cheap to add, catches the most common attack.
2. **Hard nonce store with no time window.** Rejected — unbounded memory growth; requires distributed coordination.
3. **Per-session counters.** Rejected — requires explicit session state on the backend, which we deliberately avoid (see ADR 0002).
4. **HMAC over the request plus a signed timestamp.** Rejected — reinvents AAD; JWE's GCM auth tag already covers this.
