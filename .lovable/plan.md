

# Plan: Test API Endpoints and Confirm All Dr. Green Clients

## Current State (Verified)

**Admin Account**: `healingbudsglobal@gmail.com` exists with admin role — confirmed working.
`scott@healingbuds.global` has been removed from admin — confirmed.

**API Connectivity**: Health check passes. Dr. Green API at `https://api.drgreennft.com/api/v1` responds with 200. Signing works. All secrets configured.

**Local Database** (out of sync with Dr. Green):
- 3 clients: `scott.k1@outlook.com` (VERIFIED), `scott@healingbuds.global` (VERIFIED), `motester@yopmail.com` (PENDING)
- 1 order: LOCAL-20260210 from scott.k1 (PENDING_SYNC)

**The 401 Error**: The `drgreen-proxy` Edge Function requires a valid user JWT for admin actions like `dapp-clients`. The error occurs when calls are made without a logged-in session. This is by design — admin endpoints check the JWT and then verify the user has the `admin` role.

## What Needs to Happen

### 1. Add a service-role bypass for admin sync operations
The `drgreen-proxy` currently requires a user JWT even for internal sync operations. We need a way to call `dapp-clients` and `dapp-orders` from tools (or a sync function) without requiring a browser session. Add a dedicated sync Edge Function (`sync-drgreen-data`) that uses the service role key internally — no user JWT needed — and pulls all clients/orders from the Dr. Green API into local tables.

### 2. Create `sync-drgreen-data` Edge Function
- Uses `SUPABASE_SERVICE_ROLE_KEY` to write to local DB
- Calls Dr. Green API directly (same signing logic) to fetch all clients and orders
- Upserts into `drgreen_clients` and `drgreen_orders`
- Links clients to local auth users by email match
- Returns a summary of what was synced

### 3. Trigger sync and verify data
- Call the new sync function to pull all data from Dr. Green API
- Confirm client count matches what the DApp has
- Report back all clients found

### 4. Fix AdminDashboard 401 on load
The dashboard calls `getDappClients` and `getDappOrders` which go through the proxy. If the user's session token is valid and they have admin role, this should work. The 401 likely happens on initial load before the session is fully hydrated. Add a guard: only call API endpoints after confirming the user session is valid.

## Files Changed
- `supabase/functions/sync-drgreen-data/index.ts` — new Edge Function for service-role sync
- `supabase/config.toml` — add `verify_jwt = false` for the new function
- `src/pages/AdminDashboard.tsx` — guard API calls behind session check
- `src/hooks/useDrGreenClientSync.ts` — add option to use new sync function instead of proxy

