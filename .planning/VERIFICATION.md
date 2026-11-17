# MasterGrow verification

## Observed evidence

- `npm test`: eighteen test groups pass. Real Express/SQLite/filesystem operations, source signatures, auth/tenant/role denials, immutable approvals and assignment snapshots, logout, actual Sharp decoding and FFmpeg extraction, job recovery and error handling.
- `npm run build`: TypeScript checking and production Vite build pass.
- `npm run test:e2e`: Chromium journey passes registration, workspace onboarding, journal persistence after reload, private text upload, draft/review/approval, Markdown download, training assignment and self acknowledgement, second empty workspace, mobile overflow/navigation checks.
- `npm audit`: zero vulnerabilities after updating Sharp to 0.35.5.
- Desktop and 390px mobile screenshots inspected at docs/screenshots. Fixed sidebar overflow and hidden mobile navigation accessibility. Added regression assertion for hidden navigation.
- Live Anthropic request reached the provider but returned HTTP 400: insufficient account credit. Successful live AI output and quality are not verified. Deterministic fixtures cover worker success without pretending to be live results.
- Docker CLI found; Linux daemon unavailable. Image build not executed.

## Review findings and dispositions

1. Source uploads must be private: authenticated workspace membership gates original file routes. Invalid signature uploads removed; 100 MB limit enforced by Multer. Image decode bounds enforced during analysis.
2. Cross-role approvals: owner-only approval and member restrictions tested. Approvals require review status, a nonempty checklist and current version.
3. Generated materials must not become authority automatically: schema validation, source citations, evidence gaps and draft state; no automatic approval. Scope exclusions in provider prompt and refusal response stripping.
4. Mobile off-screen navigation remained discoverable: failing browser regression reproduced, then visibility and scrim fixes verified.
5. API key configuration must not imply provider readiness: settings now say API key configured; balance/auth/rate errors have sanitized actionable messages.
6. Workspace creation/logout could reload the previous workspace: excluded those operations from record refresh, browser test verifies empty new workspace.
7. Provider-generated events missing from activity: worker now appends generation/block/failure events; audit reads system actors with a left join.

## Workflow adaptations

Requested gstack planning skills were located and applied as sequential product/engineering/design review passes, with defaults chosen under user authorization. Three built-in imagegen design explorations were generated and Botanical Atelier selected. Native gstack design-board binary was unavailable. No independent model review or gstack telemetry is claimed. Review and implementation stayed in the main thread per supplied AGENTS instructions.

GSD docs-init classified the project as a SaaS-shaped application with API, deployment configuration and tests. Documentation was written and checked sequentially. Superpowers plan, test-first behavior cycles and completion checks were used; initial absence of server modules produced missing-module failures rather than isolated behavioral assertions, followed by passing real integration tests. This is not claimed as exhaustive strict per-function TDD.

## Remaining release limits

Fund the provider account and verify output quality on non-sensitive general operations examples. Configure a hosting target and test the container/HTTPS/backup restore before public rollout. Email recovery/verification, storage quotas, malware scanning, advanced retention, SSO and native apps remain future work. Video audio is not analyzed; visual evidence is sampled. No claim of regulatory certification or complete cultivation instruction support.

## Learning release verification

- New backend tests first reproduced missing lesson/assistant routes and PDF upload rejection, then passed after implementation.
- Provider contracts tested with injected transports for OpenAI structured Responses and Anthropic tool output, including incomplete/refused responses and sanitized credit errors.
- Private chat histories isolated between two members of the same workspace. Assistant context includes approved procedure excerpts only (unapproved titles appear only in permitted review reminders).
- JPEG observations are decoded, checked against an approved step, and not stored as media. Source uploads create draft lessons in the same transaction as procedures.
- Browser regression caught delayed checkbox feedback and camera data-URL fetch blocked by CSP. Fixed optimistic progress with failure reload and direct JPEG byte conversion without weakening CSP.
- Browser confirms synthetic camera tracks end after navigation. Delayed history loading disables chat input until ready. Mobile assistant has no horizontal overflow. Speech synthesis/recognition are browser integrations, not live-device verified.
- The production dependency audit returned zero vulnerabilities. gstack HTML preview rendered with verified Chakra Petch font and no overflow at 390px; current dark screenshots reviewed.
- Source and docs reviewed sequentially in main thread. The design consultation used user-authorized recommended defaults; no outside-voice review claimed.

Design artifacts are under C:/Users/jayny/.gstack/projects/jaynyasg-Zapp/designs/midnight-fieldwork. Live generation and visual-guidance accuracy are not claimed: no OpenAI key configured; earlier Anthropic balance insufficient.

## Learner progress refinement

Verified ordinary member progress persists across logout and a new session, stays independent of another learner, and records stable completion timestamps. The studio reopens the most recently saved lesson and displays saving feedback, percentage and a dated completion confirmation. Browser coverage includes partial-progress reload, completion reload, and failed-save rollback with an explicit error.

## Integrated collection management — 2026-11-17

- New API tests first failed with missing route 404 responses. The browser journey first failed at the missing Areas navigation. Both passed after implementation.
- Regression tests caught partial task updates clearing profile links/notes and audit events using display names instead of user IDs. Both were fixed and verified.
- Layout bounds, occupancy, workspace access, stale versions, task completion and preserved links, calendar escaping/alarms, restock calculations, stock limits and audit attribution are covered by real API/SQLite tests.
- `npm test`: 21 passed. `npm run build`: passed TypeScript and production build. `npm run test:e2e`: both Chromium journeys passed. `git diff --check`: passed. No dependencies were added.
- Browser coverage includes saved placement and inventory reload, task completion, a downloaded calendar file, threshold restock suggestions and mobile overflow checks. Desktop and mobile area/material screenshots reviewed.
- Browser/OS notifications and calendar delivery on physical devices remain unverified. No background push, live AI funding claim or new hosting deployment is included. Area layouts and task deadlines are user-defined; no cultivation guidance is generated.
- GSD documentation was updated in the main thread against source and tests. The installed legacy gsd-tools CLI does not expose docs-init; the existing documentation manifest was maintained directly. No independent agent review is claimed.

## Collection separation and botanical design

Backend regression covers independent collection records, chronological measurements, workspace image ownership, referenced-image deletion protection, manual issue status and stale/unauthorized edits. Browser verification creates a profile, attaches dated images, compares photos, saves measurements, resolves an issue, reloads the timeline, checks mobile overflow, and verifies previous lesson completion remains unchanged. Screenshots use synthetic camera frames, not actual plant diagnoses. Forest palette and Lucide Cannabis branding are visual refinements. Growth forecasts and cultivation triage/coaching are not implemented.
