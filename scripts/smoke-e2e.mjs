#!/usr/bin/env node
// Exercises the full bidirectional encrypted loan flow without a browser.
// Requires: backend running on :8080, Node 18+ (global fetch), `jose` package.
// Run:  node scripts/smoke-e2e.mjs
//
// The script:
//   1. Generates an ephemeral frontend RSA key pair
//   2. Fetches the backend public key from /.well-known/jwks.json
//   3. Encrypts a sample loan payload as a JWE
//   4. POSTs it to /api/encrypted/loan with the frontend public key in a header
//   5. Decrypts the response JWE with the frontend private key
//   6. Prints both the request JWE and the decrypted response

import {
  CompactEncrypt,
  compactDecrypt,
  importJWK,
  exportJWK,
  generateKeyPair,
} from 'jose';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';

async function main() {
  console.log(`[smoke] backend: ${API_BASE}\n`);

  // 1. Ephemeral frontend key pair
  const { publicKey: feEncPub, privateKey: feEncPriv } =
    await generateKeyPair('RSA-OAEP-256', { modulusLength: 2048, extractable: true });
  const feJwk = await exportJWK(feEncPub);
  feJwk.use = 'enc';
  feJwk.alg = 'RSA-OAEP-256';
  feJwk.kid = `frontend-${Date.now()}`;
  console.log(`[smoke] frontend kid: ${feJwk.kid}`);

  // 2. Backend public key
  const jwksRes = await fetch(`${API_BASE}/.well-known/jwks.json`);
  if (!jwksRes.ok) throw new Error(`JWKS fetch failed: ${jwksRes.status}`);
  const jwks = await jwksRes.json();
  const beKeyJwk = jwks.keys[0];
  const beKey = await importJWK(beKeyJwk, 'RSA-OAEP-256');
  console.log(`[smoke] backend  kid: ${beKeyJwk.kid}\n`);

  // 3. Encrypt request
  const loan = {
    customerId: 'CUST-SMOKE',
    customerName: 'Smoke Test',
    amount: 25000,
    loanType: 'PERSONAL',
    term: 24,
    purpose: 'End-to-end smoke test',
  };
  const aad = { nonce: crypto.randomUUID(), ts: Date.now() };

  const jwe = await new CompactEncrypt(
    new TextEncoder().encode(JSON.stringify(loan)),
  )
    .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: beKeyJwk.kid })
    .setAdditionalAuthenticatedData(new TextEncoder().encode(JSON.stringify(aad)))
    .encrypt(beKey);

  console.log(`[smoke] request JWE (first 60): ${jwe.slice(0, 60)}...`);
  console.log(`[smoke] aad: ${JSON.stringify(aad)}\n`);

  // 4. POST
  const res = await fetch(`${API_BASE}/api/encrypted/loan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frontend-Public-Key': JSON.stringify(feJwk),
    },
    body: JSON.stringify({ jwe, aad }),
  });
  if (!res.ok) {
    console.error(`[smoke] ERROR ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const body = await res.json();
  console.log(`[smoke] response status: ${res.status}, encrypted: ${body.encrypted}`);

  // 5. Decrypt response
  if (body.encrypted && body.jwe) {
    const { plaintext } = await compactDecrypt(body.jwe, feEncPriv);
    const decoded = JSON.parse(new TextDecoder().decode(plaintext));
    console.log('\n[smoke] decrypted response:');
    console.log(JSON.stringify(decoded, null, 2));
    console.log('\n[smoke] OK — full bidirectional flow verified.');
  } else {
    console.log('\n[smoke] WARNING — response was not encrypted as expected.');
    console.log(JSON.stringify(body, null, 2));
  }
}

main().catch((err) => {
  console.error('[smoke] failed:', err);
  process.exit(1);
});
