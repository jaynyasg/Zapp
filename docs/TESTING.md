<!-- generated-by: gsd-doc-writer -->

# Testing

## Commands

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

API tests use Supertest against the real Express app with temporary SQLite/filesystem storage. They exercise registration, weak passwords, sessions, cross-workspace access, request origins, journal persistence, audit attribution, role restrictions, stale approvals, immutable approved records, training snapshots, file signatures and logout.

Processor tests validate malformed outputs, out-of-scope stripping, actual PNG decoding and MP4 frame extraction, interrupted-job recovery, source-linked draft creation and provider failures. The successful model response is a deterministic fixture injected at the provider boundary, not a live AI claim.

Playwright uses a production build, starts an isolated server on port 4173 and writes test records to `data/e2e`. It covers account/workspace setup, journals across reloads, media upload, procedure review/approval and mobile navigation visibility. Screenshots are saved under `docs/screenshots`; failure traces under ignored `test-results`.

## External checks

The current Anthropic account rejected a live request for insufficient credit. Live draft quality and provider-specific successful response handling require a funded account and repeat smoke test. Never use confidential customer content as a test fixture without authorization.

The Docker image and GitHub-hosted workflow are provided but were not executed in this session. No automated suite establishes regulatory compliance, completeness of sampled video interpretation or universal browser/device compatibility.

## Learning release coverage

Eighteen backend/provider test groups cover local username restrictions, lesson publication and progress, private conversations, assistant context, sanitized refusals, real JPEG observation validation, PDF signature checks, and both provider request formats. Successful external responses use fixtures; they do not establish live model quality. The browser journey additionally creates/completes a lesson, reloads progress, saves a synthetic camera frame, asserts camera tracks stop on navigation, checks disabled unfunded AI controls, and verifies the mobile assistant has no horizontal overflow. Browser camera input uses Chromium fake-device flags; no physical camera or microphone is accessed by tests. Both provider keys are cleared in the browser-test server.
