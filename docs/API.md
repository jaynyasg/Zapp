<!-- generated-by: gsd-doc-writer -->

# HTTP API

JSON API under `/api`; session cookie `mg_session` is HttpOnly. Use same-origin requests. Errors return `{ "error": "message" }`. Multipart upload is the exception to JSON requests. Private responses are marked no-store. `/health` is public and returns `{ "status": "ok" }`.

## Accounts and workspaces

| Method     | Path           | Body / behavior                                            |
| ---------- | -------------- | ---------------------------------------------------------- |
| POST       | /auth/register | name, email, password; creates session                     |
| POST       | /auth/login    | email, password; creates session                           |
| POST       | /auth/logout   | revokes current session                                    |
| GET        | /auth/me       | id, name, email                                            |
| GET        | /config        | key availability and upload limits; no secrets             |
| GET / POST | /workspaces    | list memberships / create with name, kind=home or facility |

All routes below are prefixed `/api/workspaces/:wid` and require membership. IDs are UUIDs. Members can read workspace records; training lists show members only their assignments. Owners and reviewers see all assignments.

| Method     | Suffix                    | Contract                                                               |
| ---------- | ------------------------- | ---------------------------------------------------------------------- |
| GET / POST | /members                  | list / add registered email with role member or reviewer; owner only   |
| GET        | /audit                    | latest 500 attributed events                                           |
| GET / POST | /journals                 | list / title, body                                                     |
| GET / POST | /media                    | list / multipart file, title, analyze='true' or 'false'                |
| GET        | /media/:id/file           | authorized original with range support                                 |
| POST       | /media/:id/retry          | queue stored/failed/blocked/waiting item; configured provider required |
| DELETE     | /media/:id                | owner; disallowed while processing or used as procedure evidence       |
| GET / POST | /procedures               | list / title, summary, steps[], questions[], gaps[]                    |
| PATCH      | /procedures/:id           | draft only, full editable fields plus current version                  |
| POST       | /procedures/:id/submit    | current version; nonempty checklist required                           |
| POST       | /procedures/:id/approve   | owner only, review state and current version                           |
| POST       | /procedures/:id/return    | review back to draft; current version                                  |
| POST       | /procedures/:id/revise    | approved -> new linked draft; current version                          |
| GET        | /procedures/:id/export    | downloadable Markdown                                                  |
| GET / POST | /assignments              | list / procedureId, userId, dueDate=YYYY-MM-DD                         |
| POST       | /assignments/:id/complete | assigned user only; repeat completion is idempotent                    |

Procedure writes and assignment creation require reviewer or owner. Generated procedures additionally carry `sourceId`, `author`, `generatedAt`. Assignment `snapshot` preserves approved text. Stale or invalid workflow transitions return 409; missing record 404; membership/role denial 403; unsigned requests 401; invalid input 400; unsupported source type 415; oversize upload 413.

## Learning and assistant routes

All paths below share the workspace prefix and membership checks above.

| Method | Suffix | Contract |
| --- | --- | --- |
| GET | /lessons | Published lessons for members; all lessons for reviewers/owners, with caller-only progress |
| POST | /lessons | procedureId; reviewer/owner; approved, nonempty source required; 201 new or 200 existing |
| POST | /lessons/:id/publish | reviewer/owner; copies approved procedure into draft; repeat is idempotent |
| PUT | /lessons/:id/progress | completed: integer step indices; caller-only; published lesson required |
| GET | /briefing | Pending training, review and processing signals with navigation destinations |
| GET | /assistant | Current user's conversation in this workspace, up to 40 stored messages |
| POST | /assistant | message up to 4,000 characters; returns updated history; configured provider required |
| DELETE | /assistant | Deletes caller's conversation; 409 while an AI request is active |
| POST | /observe | procedureId, zero-based step, image (JPEG data URL, max 220,000 characters); approved source required |

Observation response: allowed, reply, observations[], uncertainties[], checkedAt. Frames are not persisted. Chat and observations share 25 requests per five minutes per user and one concurrent request. Provider setup/funding failures return 503 with sanitized text. PDF originals download as attachments. Analysis produces media.lessonId alongside media.procedureId.
