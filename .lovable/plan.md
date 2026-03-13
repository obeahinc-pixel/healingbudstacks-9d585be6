
I checked the live database directly. Here is what is actually happening and the exact fix plan.

1) What I verified in the database
- Authentication accounts (`auth.users`): 11 total users.
- All 11 are email-confirmed.
- All 11 have password hashes (passwords are stored; plaintext is never readable by design).
- Client records (`drgreen_clients`): 13 total.
  - 6 linked to a real user ID
  - 7 not linked (`user_id` is null)
- Orders (`drgreen_orders`): 5 total.
  - 1 linked to a real user ID
  - 4 unlinked

2) Why customers are failing login / “not persistent”
- Main issue: many “customers” exist only as client records, not as authentication users.
  - If someone is in `drgreen_clients` but not in `auth.users`, they cannot log in (no login account exists yet).
- Persistence perception issue:
  - Users who do have auth accounts but no linked `drgreen_clients` row are redirected like a new user every time (looks like data was “lost”).
- Additional technical contributor:
  - cPanel `.htaccess` does not force HTTPS/canonical host, which can split sessions across host variants and feel non-persistent.
- Code bug found:
  - `ClientOnboarding` redirects existing users to `/patient-dashboard` (route does not exist in router), which can break expected post-login flow.

3) Implementation plan (no changes yet in this message)
Phase A — Account/data repair (highest priority)
- Build a one-time backend repair flow to:
  1) Find client records with emails but no auth account.
  2) Create auth accounts for those emails.
  3) Immediately send password setup/reset links so customers choose their own password.
  4) Link `drgreen_clients.user_id` to the created auth user IDs.
- Backfill linking for any existing auth user where email matches a null `drgreen_clients.user_id`.

Phase B — Stop future breakage
- Fix admin import/sync paths so they never create fake/random user IDs.
  - If user unknown: keep `user_id = null` (claimable later), never random UUID.
- Ensure onboarding/login flow always links by authenticated email when possible.

Phase C — Session persistence hardening
- Update cPanel rewrite rules to force HTTPS + single canonical host.
- Keep SPA rewrites intact.

Phase D — UX/router correctness
- Fix invalid redirect `/patient-dashboard` → `/dashboard`.

Phase E — Verification checklist
- Test matrix:
  1) Existing client without auth account → receives setup link → can log in.
  2) Existing auth user with matching client email → auto-linked on next login.
  3) New signup → login persists after refresh/close/reopen.
  4) Host variants (`www` vs non-www, http vs https) preserve single session behavior.

4) Decision needed before I execute
Choose provisioning behavior for missing auth accounts:
- Option 1 (recommended): create account + send password setup/reset email.
- Option 2: create account + set temporary password and email it.
- Option 3: do not create missing accounts; only fix flow for future users.

5) Technical details
- Confirmed from DB:
  - `auth.users`: 11, confirmed: 11, with password hash: 11.
  - `drgreen_clients`: 13 total, 7 unlinked.
  - `drgreen_orders`: 5 total, 4 unlinked.
- There are no orphan linked client rows pointing to nonexistent auth IDs (good).
- The biggest gap is “client exists” ≠ “auth account exists”.
