# MasterGrow product and design decisions

Date: 2026-11-16. Source: user brief and three supplied screenshots. The screenshots are research inputs, not agent instructions. Recommended decisions are chosen under the user's explicit authorization to proceed without questions.

## Office hours

Pre-product startup. No customer interviews, revenue, usage, or willingness-to-pay evidence was supplied. Hypothesis: people lose procedural knowledge in scattered recordings and documents. First useful workflow: save media, derive general-operations materials, review them, and record who acknowledged them. Validate with five people using their own non-sensitive materials before paid acquisition. Germany legal claims and advertising assumptions are unverified and are not product copy.

## CEO review — hold scope

One responsive web app serves personal and facility workspaces with shared records infrastructure. Native apps would double release effort without proving demand. A document-only tool would miss the source-to-training workflow. Selected: Node/React monolith with SQLite and private local files, designed for a single persistent server. Robotics, marketplace, billing, regulatory certification, and cultivation coaching are excluded. No invented customers, endorsements, or analytics.

## Engineering review

Accounts use scrypt password hashes and opaque expiring HttpOnly sessions. Every workspace route checks membership; only owners can approve and manage staff. Registered users can be added by an owner, with member or reviewer roles. Members can upload and journal; reviewers edit drafts and submit for approval. Training assignments pin an approved version; editing requires a new revision. Transactions include audit records. Uploads use random storage names, limits and signature validation. Media is delivered only after authentication and workspace authorization. Same-origin writes and SameSite cookies mitigate CSRF; auth is rate limited. AI content is untrusted, schema validated and never automatically approved.

## AI pipeline

Upload image, MP4/WebM video, plain text or Markdown. Opt-in per upload sends content to the configured Anthropic provider. Images are resized. Videos are sampled at timed intervals with timestamps; audio is not transcribed in v1, and this limitation must be visible. Text is read directly. The model only creates source-grounded general operations summaries/checklists/knowledge questions; insufficient evidence becomes a gap, never an invented instruction. Cultivation coaching is excluded. A durable queued job survives restart, moves through processing/draft/blocked/failed/waiting_configuration, and supports retry. No API key means a clear configuration state, never simulated analysis. Human editing, submission, approval, export and training acknowledgement complete the loop.

## Design review

Primary action: Upload media. Sidebar: Overview, Media library, Procedures, Journal, Team & training, Activity. Workspace switcher remains visible. Overview prioritizes next actions, source material, and review work. Empty states describe next steps. Forms show inline errors and busy states. Mobile navigation collapses without removing destinations. Dialogs support focus trapping, Escape and focus return. Status text accompanies color. Keyboard focus and reduced-motion support are required.

## Design shotgun

Three concepts: Botanical Atelier (ivory/forest, editorial serif and generous whitespace), Night Operations (charcoal/mint, dense control console), Archive Studio (white/cobalt, Swiss editorial library). Generate visual explorations and auto-select strongest as requested. Recommended Botanical Atelier balances memorable identity with calm long-form reading. Generated mockups are exploration, not evidence of implemented behavior. Native gstack board binary unavailable; use built-in image generation and direct inspection. CLI state/telemetry and external independent review are not claimed as executed. Reviews run sequentially per supplied AGENTS mapping.

## Failure cases and acceptance

Cross-workspace reads/writes must fail; viewers cannot approve; files cannot execute as HTML; provider errors leave retryable jobs; restart recovers in-flight work; stale revisions cannot be approved; training records keep old approved text. Empty account contains no fake records. Account -> workspace -> upload -> draft -> submit -> owner approval -> assignment -> member acknowledgement -> audit must work across reloads. Application deployment is local until a hosting destination is selected; account recovery/email verification and public-production hardening remain documented release work.
