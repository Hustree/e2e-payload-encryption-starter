# Configuration

All backend knobs live in [`backend/src/main/resources/application.properties`](../backend/src/main/resources/application.properties). Frontend env vars live in [`frontend/.env.example`](../frontend/.env.example).

## Backend

### HTTP

| Property | Default | Effect |
|---|---|---|
| `quarkus.http.port` | `8080` | HTTP port the backend binds to |
| `quarkus.http.cors` | `true` | Enables CORS handling |
| `quarkus.http.cors.origins` | `http://localhost:3000` | Comma-separated allowlist. **Never set to `*` in production.** |
| `quarkus.http.cors.headers` | `origin, content-type, accept, authorization, x-requested-with, x-frontend-public-key` | Headers browsers may send. Must include `x-frontend-public-key`. |
| `quarkus.http.cors.methods` | `GET, POST, PUT, DELETE, OPTIONS, HEAD` | Methods the browser preflight is allowed to surface |
| `quarkus.http.cors.exposed-headers` | `*` | Headers the browser can read from responses |
| `quarkus.http.cors.access-control-max-age` | `24H` | Preflight cache duration |

### Encryption

| Property | Default | Effect |
|---|---|---|
| `encryption.key` | `my-super-secret-aes-256-key-32ch` | **POC-only** symmetric key used by the legacy AES-CBC path. Replace before any non-demo use. See [SECURITY.md](../SECURITY.md). |

RSA key material for the JWE path is generated in-process at startup by `RSAKeyManager` and is not configurable via properties. The `kid` rotates on every restart.

### Logging

| Property | Default | Effect |
|---|---|---|
| `quarkus.log.level` | `INFO` | Root log level |
| `quarkus.log.category."com.example".level` | `DEBUG` | App log level — set to `INFO` in production |

### Jackson

| Property | Default | Effect |
|---|---|---|
| `quarkus.jackson.fail-on-unknown-properties` | `false` | Forward-compatibility — new fields don't break deserialization |

## Frontend env

Frontend uses Create React App's `REACT_APP_*` convention. Copy `.env.example` → `.env.local` for local overrides.

| Env var | Default | Effect |
|---|---|---|
| `REACT_APP_API_URL` | `http://localhost:8080` | Base URL for backend API calls (including JWKS fetch) |
| `REACT_APP_ENCRYPTION_KEY` | `my-super-secret-aes-256-key-32ch` | **POC-only** symmetric key for the legacy AES-CBC demo path. Must match backend `encryption.key`. Not used by the JWE flow. |

## Environment-specific notes

| Environment | What changes |
|---|---|
| Local dev | Defaults as-is. Dev mode hot-reloads Java on `./mvnw quarkus:dev`. |
| CI | Frontend `npm ci` + `npm run build`; backend `./mvnw verify`. See [`.github/workflows/`](../.github/workflows/). |
| Production | Remove hardcoded `encryption.key`. Source RSA key pair from a KMS. Narrow CORS origins. Set `quarkus.log.category."com.example".level=INFO`. |

## Not exposed to the frontend

These values never leave the backend:

- The RSA private key
- `encryption.key`
- CORS configuration
- Log levels and audit sinks
