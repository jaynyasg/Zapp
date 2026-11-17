<!-- generated-by: gsd-doc-writer -->

# Configuration

## Collection reminders

No new environment variables or AI credits are required for layouts, tasks or inventory. Enable browser notifications from **My collection → Tasks**. Permission and the preference apply to the current browser; the preference is scoped by account and workspace. Alerts refresh every 30 seconds while the app is open. Mobile notification support varies; use a downloaded calendar alarm where browser notifications are unavailable. There is no background push configuration in this release.

Manually provisioned local accounts may use a username instead of an email. These accounts can sign in only through loopback connections, with a loopback HOST and NODE_ENV other than production. The same restriction applies to existing sessions. Public registration still requires an email and a password of at least 12 characters. Local accounts are stored only in the private database; no default credentials are shipped.

The npm scripts load `.env` when it exists. Copy `.env.example`; never commit real keys.

| Variable          | Default                   | Purpose                                     |
| ----------------- | ------------------------- | ------------------------------------------- |
| HOST              | 127.0.0.1                 | Bind address; Docker uses 0.0.0.0           |
| PORT              | 3001                      | HTTP port                                   |
| DATA_DIR          | data                      | SQLite and uploads directory                |
| APP_ORIGIN        | request protocol and host | Exact allowed Origin for browser writes     |
| COOKIE_SECURE     | false                     | Set true behind HTTPS                       |
| TRUST_PROXY       | 0                         | Set 1 only behind one trusted reverse proxy |
| NODE_ENV          | unset                     | Use production for deployment               |
| AI_PROVIDER | auto | auto, openai or anthropic; auto prefers an available OpenAI key |
| OPENAI_API_KEY | unset | Server-side OpenAI credential |
| OPENAI_MODEL | gpt-4.1-mini | Responses API model |
| ANTHROPIC_API_KEY | unset                     | Server-side key for automatic analysis      |
| ANTHROPIC_MODEL   | claude-sonnet-4-5         | Model sent to the Messages API              |

AI availability displayed in settings means a key is present, not that its account has credit or has passed a health check. Restart after changing configuration. Files uploaded without a key remain stored and can be explicitly retried later. Analysis is selected per upload; there is no automatic transmission of all stored material on configuration change.

Limits: uploads 100 MB, PDFs 10 MB, text files 1 MB, text analysis 60,000 characters, videos 10 minutes and 12 sampled frames, decoded images 40 million pixels, API JSON bodies 256 KB. Provider calls time out at 90 seconds. Sessions expire after seven days. Auth requests are rate limited to 60 requests per 15 minutes per client IP; rate limits are local to the process.

Development accepts `http://127.0.0.1:5173` as an additional Origin. The Vite proxy assumes API port 3001. Avoid changing the development API port without updating `vite.config.ts`.

Chat and live guidance share a limit of 25 requests per five minutes per user, with one concurrent request per user. Browser guidance samples every 15 seconds and pauses after 20 completed checks. Camera frames are bounded to 220,000 data-URL characters and decoded to at most 4 million pixels. OpenAI requests use store:false; this does not override provider retention policies. See [Learning and AI](LEARNING-AND-AI.md) for consent, credits and browser requirements.
