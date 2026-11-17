# Project guidance

## Design System

Read DESIGN.md before visual changes. It is the design source of truth. Preserve the Midnight Fieldwork forest-green palette and cannabis-leaf brand mark, locally bundled Chakra Petch display / DM Sans body pairing, accessible controls, real empty states, and explicit AI readiness and uncertainty. Follow existing layout patterns in src/styles.css and src/learning.css.

## Implementation

Keep provider credentials on the server. Check workspace membership on every data route. AI-produced materials remain drafts until the source procedure has been human-approved. Maintain the general operations scope. Preserve source evidence and immutable approved snapshots.

Run npm test, npm run build and npm run test:e2e for changes affecting authenticated workflows. Use isolated test databases and provider fixtures. Never commit data, .env files, or credentials. Run delegated work sequentially in the main thread, as requested by the project owner.

Keep collection records independent of lessons: collection photos are store-only, issue resolution is manual, and measurement charts show recorded observations only. Do not introduce automated cultivation guidance, diagnosis or growth forecasts.
