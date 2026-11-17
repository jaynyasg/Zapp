<!-- generated-by: gsd-doc-writer -->

# Learning, capture and assistance

## Upload to lesson

Upload JPG, PNG, WebP, MP4, WebM, PDF, TXT or MD to the private Media library or Capture & practice. Select analysis to send the source to the configured provider. Store-only uploads never go to AI automatically. PDF documents are limited to 10 MB and sent directly as document inputs; scanned PDFs depend on the model's vision support. Office files and hardware scanner protocols are not supported: export them as PDF first.

The durable worker produces a source-cited procedure draft and a linked lesson draft in one transaction. The procedure supplies the lesson summary, ordered steps, reflection questions and evidence gaps. This is a structured learning framework, not generated animations or video editing. Unsupported content is marked blocked; failed jobs remain retryable. There is no pretend lesson when the provider fails.

Review the procedure, correct its evidence, submit it, and have an owner approve it. In Learning studio, select the draft and publish. Publishing copies the approved procedure into an immutable lesson. Owners and reviewers can also create a published lesson from an existing approved procedure. Revising an approved procedure creates a new source version and can produce a new lesson; old lessons and progress retain their original content.

Learners check off steps to save progress automatically to their own account. The lesson player shows saving/saved feedback and a completion percentage. Returning to Learning studio reopens the most recently saved lesson, including after signing in again or using another browser. Completing every step shows a Completed label and a Lesson completed confirmation with its date and time. Unchecking a step returns the lesson to in progress. Failed saves restore the prior displayed progress and show an explicit retry message. Reflection questions are self-study, not automatically graded. Completion records acknowledgement, not practical competence or certification. Draft lessons are hidden from members.

## Mobile capture and guided practice

Use HTTPS on a phone, or localhost on the same computer. Plain HTTP over a LAN normally cannot access camera APIs. Enable camera explicitly and grant browser permission. The default prefers the rear camera; browser-visible USB cameras can be selected after access is granted. Save photo stores a JPEG in the workspace. The file picker accepts existing photos, recordings and scanner-exported PDFs; device-specific capture choices vary by OS.

Choose an approved general-operations procedure and its current step, then Start guidance. One resized JPEG is sent every 15 seconds, with only one request in flight and a maximum of 20 completed checks per start. Pausing stops further checks; Stop camera, leaving the page, or hiding the tab stops camera tracks. A provider request already sent may still finish and incur usage even if the browser aborts it.

Feedback separates visible observations and uncertainties. Frames are not persisted by the app unless Save photo is used, but provider retention policies apply. This is sampled visual assistance, not continuous video interpretation, a reliable mistake detector, safety monitoring or automatic task completion. Cultivation coaching is excluded. Direct scanner drivers, Bluetooth scanners, native mobile apps and continuous realtime audio/video transport are extension points.

## Assistant

AI assistant supports typed questions and optional browser dictation. Review the dictated transcript before pressing Send. Supported browsers may send microphone audio to their speech service; there is no app-hosted transcription or OpenAI Realtime audio session. Read replies aloud uses browser speech synthesis, with support and voices varying by device.

The assistant receives bounded excerpts from up to six approved procedures, the current user's pending training, source processing issues, and permitted review-queue titles. It also receives up to eight recent message excerpts. It cannot execute record changes. Each account has one private conversation per workspace, capped at 40 stored messages; Clear conversation deletes that stored history. It does not delete provider-side retention.

Workspace pulse proactively shows pending training, review and processing issues from actual records, refreshing every minute while visible. These are deterministic reminders. The assistant can discuss the same context reactively. Background push notifications, autonomous actions and scheduled AI messages are not implemented.

## Provider setup and credits

Set OPENAI_API_KEY or ANTHROPIC_API_KEY in the server environment. AI_PROVIDER defaults to auto: OpenAI wins when its key is present, otherwise Anthropic. Explicit openai or anthropic selects only that provider; there is no silent paid fallback. Restart after changing configuration. OPENAI_MODEL defaults to gpt-4.1-mini; ANTHROPIC_MODEL defaults to claude-sonnet-4-5. Model availability depends on the provider account.

The app has no bundled AI credits or billing-balance lookup. A configured key is not proof of credit. OpenAI billing is managed at https://platform.openai.com/settings/organization/billing/overview. Eligible ChatGPT subscriptions may offer API credits after linking an API organization: https://developers.openai.com/api/docs/guides/chatgpt-api-credits. Eligibility and amounts must be checked in the user's account; they are not inferred from this Codex session.

No OpenAI key was configured during implementation. The earlier live Anthropic check reported insufficient credit. Successful live lesson generation, conversation quality, real camera interpretation and device voice behavior remain deployment validation tasks; fixtures verify adapter and application behavior without claiming a live model evaluation.

## Extension seams

- server/ai.js: provider selection and structured request transport; server-only credentials.
- server/processor.js: source extraction, durable analysis jobs and atomic procedure/lesson creation.
- server/learning.js: publication, private learner progress, briefing, chat and image observations.
- src/Learning.tsx: lesson player, assistant voice controls, camera lifecycle and sampled guidance.
- Replace browser dictation with a server-issued ephemeral realtime session for continuous voice, with separate usage controls and explicit consent.
- Add a reviewed question/answer schema and competency evaluations before implementing scored assessments.
