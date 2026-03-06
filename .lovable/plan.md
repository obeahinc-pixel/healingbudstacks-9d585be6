

# Plan: Fix 401 Errors, Sync Data, and Resolve Regression

## Root Cause Analysis

The regression has **three distinct causes**:

1. **`get-orders` returns 404**: The proxy calls `/dapp/clients/{clientId}/orders` which does NOT exist in the Dr. Green API. The correct endpoint is `/dapp/orders` with query params. Edge function logs confirm repeated `Response status: 404` for every `get-orders` call. This breaks the patient dashboard order history.

2. **Admin dashboard 401s on summary endpoints**: `dashboard-summary`, `sales-summary`, `get-clients-summary` are called but don't exist in the Dr. Green API. These were already partially fixed in previous iterations but may still be called from other components.

3. **Data desync**: The `sync-drgreen-data` function works (just confirmed -- 11 clients, 4 orders fetched) but only 4 clients were upserted (those with matching local auth accounts). Orders returned 0 upserts because the order `clientId` maps to Dr. Green client IDs, and the `clientToUser` lookup only found matches for locally-linked clients. The single existing local order has `drgreen_order_id = LOCAL-20260210` which doesn't match any API order ID.

## Current State (Just Verified)

- **`healingbudsglobal@gmail.com`** exists as admin -- confirmed working
- **`scott@healingbuds.global`** admin role removed -- confirmed
- **11 clients** on Dr. Green API, **4 linked locally** (scott.k1, kayliegh.sm, motester, scott@healingbuds.global)
- **4 orders** on Dr. Green API, **1 local order** (unlinked, local-only ID)
- **sync-drgreen-data** Edge Function deployed and operational

## Implementation Steps

### 1. Fix `get-orders` action in drgreen-proxy (Root cause of 404)
Change the `get-orders` case from calling the non-existent `/dapp/clients/{clientId}/orders` to calling `/dapp/orders` with a `clientIds` query parameter filter (same pattern as `dapp-orders` admin action).

**File**: `supabase/functions/drgreen-proxy/index.ts` (lines ~3120-3131)

### 2. Fix `get-client-orders` action (if present)
Check if `get-client-orders` in `useDrGreenApi.ts` also uses a broken endpoint path and fix it similarly.

### 3. Fix sync-drgreen-data order upsert logic
The current logic skips orders when the client has no local `user_id`. Fix: for orders where the client exists in `drgreen_clients`, use that user's `user_id`. For orders where the client has no local account, create a placeholder mapping or skip gracefully with proper logging.

### 4. Remove deprecated summary endpoint calls
Search for any remaining calls to `getDashboardSummary`, `getSalesSummary`, `getClientsSummary` across the codebase and remove them. The dashboard was already partially fixed but there may be residual references.

### 5. Trigger a full sync after fixes
After deploying the proxy fix, call `sync-drgreen-data` to pull all 11 clients and 4 orders into the local database correctly.

## Files Changed

- `supabase/functions/drgreen-proxy/index.ts` -- fix `get-orders` endpoint path from `/dapp/clients/{id}/orders` to `/dapp/orders` with clientId filter
- `supabase/functions/sync-drgreen-data/index.ts` -- improve order upsert to handle all 4 orders
- `src/hooks/useDrGreenApi.ts` -- clean up deprecated summary methods, fix `getClientOrders` if broken

