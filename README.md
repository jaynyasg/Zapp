<!-- generated-by: gsd-doc-writer -->

# MasterGrow

A private workspace for source media, general operations procedures, journals and team training. MasterGrow Home and MasterGrow SOP share one responsive application.

## Start locally

Requires Node.js 24.15 or later and npm.

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3001, create an account, and create a Home or Facility workspace. New accounts start empty. There are no default credentials or seeded business records.

For development, run `npm run dev` and open http://127.0.0.1:5173. The Vite proxy sends API requests to port 3001.

## What works

- Register, sign in and out; create and switch private workspaces.
- Add registered users as members or reviewers; workspace owners approve procedures.
- Upload JPG, PNG, WebP, MP4, WebM, PDF, TXT and Markdown. View private images and videos; download original documents.
- Opt into automatic analysis for general operations: summary, source-cited checklist, knowledge questions and evidence gaps.
- Edit drafts, submit for review, approve, create revisions, export Markdown.
- Assign approved procedures and acknowledge training. Assignments preserve the original approved content.
- Record journal entries and inspect the activity history.
- Turn analyzed sources into lesson drafts; publish from approved procedures and save private learner progress.
- Capture phone/USB camera photos, import scanner PDFs, and opt into sampled visual practice guidance.
- Ask a private text assistant about reviewed workspace material, with optional browser dictation and spoken replies.
- See proactive reminders based on pending training, reviews and source processing issues.
- Keep plant, seed-lot and material records in My collection, with dated photos, manual measurements and issue logs separate from lessons.
- Use the cannabis-inspired Midnight Fieldwork dark interface on desktop and mobile.

## Enable AI

Copy `.env.example` to `.env`, set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, and restart. Existing environment variables are also read. A funded provider account is required. `AI_PROVIDER=auto` prefers OpenAI when both keys exist; explicit `openai` or `anthropic` selects one. In the app, select **Turn this into a useful draft** while uploading. Existing files can be processed using **Analyze source**.

The live provider smoke test on this build was rejected because the configured account had insufficient credit. Provider integration exists, but a successful live generation has **not** been verified. Deterministic worker tests exercise successful draft creation without external billing. API keys are never sent to the browser or stored in Git.

Video analysis samples up to 12 frames across clips up to 10 minutes. It does **not** transcribe audio or observe every action. Text analysis uses the first 60,000 characters. All generated materials are drafts. Cannabis cultivation coaching and procedural production content are excluded from generation.

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Tests cover workspace access, auth, workflow permissions, approved snapshots, source validation, extraction, job recovery and a browser journey. Browser tests use a separate `data/e2e` database and save screenshots to `docs/screenshots`.

## Documentation

- [Learning, capture, voice and AI setup](docs/LEARNING-AND-AI.md)
- [Getting started](docs/GETTING-STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Configuration](docs/CONFIGURATION.md)
- [API](docs/API.md)
- [Development](docs/DEVELOPMENT.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Product decisions](docs/designs/mastergrow.md)

This is a locally verified first release, not a deployed public service. Email verification/password recovery, billing, native apps, multi-server operation and enterprise compliance certification are not implemented. Review the deployment document before public use.
