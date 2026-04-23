# scripts/

Standalone helper scripts for the repo. Independent of the frontend/backend apps.

## `dev.sh`

Runs the backend (Quarkus :8080) and frontend (React :3000) concurrently. Ctrl-C stops both.

```bash
./scripts/dev.sh
```

## `smoke-e2e.mjs`

Exercises the full bidirectional encrypted loan flow without a browser. Useful as a contract check when changing the backend.

```bash
# one-time setup
cd scripts && npm install

# start the backend in another terminal, then:
npm run smoke
```

The script prints the compact-JWE request, POSTs it, and pretty-prints the decrypted response.
