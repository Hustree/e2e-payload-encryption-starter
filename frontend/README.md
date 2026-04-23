# Frontend

React 19 + TypeScript + Create React App + `jose` library.

See [`../README.md`](../README.md) for the project overview and quick start.
See [`CLAUDE.md`](CLAUDE.md) for frontend-specific conventions.

## Commands

```bash
npm install          # install deps
npm start            # dev server on :3000 (requires backend on :8080)
npm run build        # production bundle
npm test             # jest via react-scripts (watch mode)
npm test -- --watchAll=false   # jest one-shot
npx playwright test  # Playwright E2E (requires backend running)
```

## Env

Copy `.env.example` → `.env.local` and override as needed. See [`../docs/configuration.md`](../docs/configuration.md) for the full list of env vars.
