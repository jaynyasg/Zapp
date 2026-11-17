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

## Learning features

Provider adapters live in server/ai.js; learning and assistant routes live in server/learning.js. Inject respond into createApp for deterministic AI route tests, or transport/env into structuredResponse to test provider contracts without network billing. Follow DESIGN.md and keep new styles in src/learning.css. Camera components must stop all tracks and ignore stale observations after unmount. Do not add default accounts or keys to seed scripts.

## Collection management

Keep the single profile catalog in `server/collection.js` and the integrated navigation in `src/Collection.tsx`. `server/garden.js` adds linked layout/task/material records; `src/Garden.tsx` renders them. Preserve workspace membership, version checks and atomic stock/placement mutations. Optional PATCH fields must not inject defaults that erase existing links. Test audit attribution with user IDs, not display names.

Use `tests/garden.test.js` for API regression cases and `e2e/garden.spec.ts` for the integrated collection workflow. All quantities, thresholds and tasks are entered by users. No AI key is required, and collection operations must not change lesson progress or generate growth recommendations.
