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
