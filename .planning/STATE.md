# State

Current release, 2026-11-17: multi-site grow projects are implemented inside My collection. Users can create sites, organize projects across one or more sites, track manual project status and task completion, and assign/filter records, areas, tasks and materials. Legacy records remain unassigned and navigable. Current verification: 23 backend/provider tests, three Chromium journeys and production build pass; desktop/mobile screenshots inspected. Sites/projects share workspace membership and do not change lesson progress.

Learning/capture/assistant framework and Midnight Fieldwork dark redesign are implemented. Twenty-one backend/provider test groups pass, TypeScript and production build pass, and the expanded Chromium journey passes lesson progress, private media, synthetic camera capture/cleanup, delayed chat loading and mobile checks. Production dependency audit reports zero vulnerabilities.

Live AI remains unverified: no OpenAI key is configured; the earlier Anthropic smoke test returned insufficient credit. Browser voice and physical devices require target-device validation. Continuous realtime audio/video, direct scanner drivers, push notifications, public hosting and production hardening remain outside this framework release. See docs/LEARNING-AND-AI.md and VERIFICATION.md.

Local server: http://127.0.0.1:3001. Repository branch: codex/mastergrow. User authorized commit and push after verification. Local database accounts and credentials are excluded from Git.

Collection release: separate plant/seed/material records, dated photos, manual measurement history and issue review are implemented and tested. Navigation separates everyday records from lessons. The visual system now uses forest surfaces and cannabis-leaf branding. Automated growth forecasts and cannabis coaching/diagnosis are excluded.

2026-11-17 collection management: Records, Areas, Tasks and Materials are combined inside My collection. Saved layouts, linked user tasks with snooze/completion, inventory adjustments, low-stock alerts and target-based restock suggestions are implemented. Open-app browser notifications and calendar-alarm downloads are available; background push remains unimplemented. Verification: 21 API/provider tests, both Chromium journeys and production build pass; desktop/mobile screenshots inspected. Documentation updated sequentially with the GSD workflow and source checks.
