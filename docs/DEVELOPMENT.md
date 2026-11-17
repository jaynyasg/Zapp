<!-- generated-by: gsd-doc-writer -->

# Development

## Setup

`npm ci` installs the lockfile. `npm run dev` runs Express with Node's file watcher and Vite with React refresh. Open port 5173. `npm run build` checks TypeScript and builds `dist`; `npm start` serves the built app on port 3001.

## Structure

- `src/`: React interface, shared components, styles and typed contracts.
- `server/`: API, persistence and asynchronous processing.
- `tests/`: real API/SQLite integration and extraction tests.
- `e2e/`: Playwright browser flow.
- `.planning/`: requirements, progress and verification evidence.
- `docs/`: design decisions and operating documentation.

## Changes

Keep every workspace query scoped by membership. Preserve immutable approved procedures and training snapshots. Add a regression test before altering authorization or state transitions. External AI should be substituted at the provider boundary in automated tests; extraction and persistence should remain real. Never seed production with fictional users or analytics.

Use explicit schema changes for future database migrations. The initial schema is created by `openDatabase`; there is no migration framework yet. Format edited sources consistently. Run the commands in TESTING before release.

## Known release work

Public rollout needs account recovery/email verification, deployment-specific HTTPS/proxy configuration, storage quotas, backup restoration checks, malware scanning policy and independent security review. The app has no billing, telemetry service, native app packaging or compliance certification.
