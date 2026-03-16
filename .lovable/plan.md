
Goal: make client data reliably persist and load on first app paint, and stop new account/link corruption.

What I found (from code + DB):
1) Current DB is mostly repaired:
- `drgreen_clients`: 13 total, 0 unlinked.
- `auth.users`: 19, `profiles`: 19, no missing profiles.
- Auto-link trigger path is active (`on_auth_user_created` -> `handle_new_user` -> `on_profile_created_link_drgreen` -> `auto_link_drgreen_on_signup`).
2) Real breakage still in admin sync/import flows:
- `src/components/admin/AdminClientImport.tsx` inserts `drgreen_clients.user_id = crypto.randomUUID()` (invalid linkage pattern).
- `src/components/admin/AdminClientManager.tsx` background sync also writes `user_id: existingMap.get(...) || crypto.randomUUID()`.
- This is the main source of future “not persistent / not linked” regressions.
3) Startup hydration race in client state:
- `ShopContext` calls `fetchCart()`/`fetchClient()` before wiring auth listener.
- If session hydration lags, it can set `drGreenClient = null` too early, causing wrong redirects and “data disappeared” perception.
4) Session stability risk in deployment config:
- `public/.htaccess` has SPA rewrite first and HTTPS/canonical rewrites later; this can allow host/protocol split behavior depending on server rewrite order.

Recommendation on your question (ricardo.drgreennft.com login vs knowledge/code):
- Do not log into external Dr. Green portal first. We already have enough hard evidence in local code + DB to fix root causes.
- Use preview/browser testing only after code fixes to verify flow end-to-end.

Implementation plan:
Phase 1 — Stop creating bad links (highest priority)
- AdminClientImport:
  - Remove random UUID `user_id` writes.
  - If no authenticated/local user match exists, store as unclaimed record (`user_id = null`) or call server-side sync with real `localUserId`.
- AdminClientManager:
  - Remove random UUID fallback.
  - Only write `user_id` when matched to a real auth user; otherwise leave null.
  - Keep sync of non-PII status fields independent of `user_id`.

Phase 2 — Make startup always load client data from session first
- Refactor `ShopContext` bootstrap:
  - Register `onAuthStateChange` listener first.
  - Then run one bootstrapped `getSession()` pass.
  - Add `authReady`/`initialized` guard so redirects wait until auth + first client fetch settle.
  - Prevent duplicate parallel `fetchClient()` calls from racing each other.

Phase 3 — Harden domain/session persistence
- Reorder `.htaccess`:
  1) force HTTPS
  2) force non-www canonical host
  3) then SPA rewrite to `index.html`
- This prevents split auth storage across host/protocol variants.

Phase 4 — Guardrails against recurrence
- Add a one-click admin health check (or dashboard warning) for:
  - `drgreen_clients.user_id is null` count
  - mismatched `drgreen_clients.email` without auth counterpart
- Keep Account Repair tool as remediation, but ensure normal flows no longer require it.

Validation checklist after implementation:
1) Existing linked customer logs in, refreshes, closes/reopens browser: still linked and routed correctly.
2) Newly imported/admin-synced customer does not get fake `user_id`; link happens only with real auth user.
3) New signup with matching client email auto-links immediately after first login.
4) HTTP/www entry points end up on one canonical HTTPS domain and session remains stable.
5) No runtime 401 crash paths from startup client lookup.

Technical details:
- Files to change:
  - `src/components/admin/AdminClientImport.tsx`
  - `src/components/admin/AdminClientManager.tsx`
  - `src/context/ShopContext.tsx`
  - `public/.htaccess`
- DB changes likely not required for this fix (schema already supports nullable `user_id` and trigger-based linking), but we will run one post-fix verification query set before/after release.
