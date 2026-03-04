

# Plan: Sync Now Button, Realtime Dashboard, Email Logo Branding

## Summary

Three changes: (1) Add a "Sync Now" button on the admin dashboard that calls `sync-drgreen-data` edge function + realtime subscriptions for live updates, (2) verify admin/clients page shows all clients (already working via `AdminClientManager`), (3) fix email templates in `drgreen-webhook` to use the correct Healing Buds logos — white logo on dark/teal backgrounds, teal/green logo for light backgrounds.

---

## 1. Admin Dashboard — "Sync Now" + Realtime

**File: `src/pages/AdminDashboard.tsx`**

- Replace the existing "Sync Client Data" button (line 376-384) with a "Sync Now" button that calls `supabase.functions.invoke('sync-drgreen-data')` instead of the client-side `useDrGreenClientSync` hook
- Add loading state (`syncing`) and show results in a toast (clients synced, orders synced, errors)
- Add a `useEffect` that subscribes to `postgres_changes` on `drgreen_clients` and `drgreen_orders` tables — on any change, auto-refetch stats and recent activity
- Add a small pulsing green dot "Live" indicator next to the dashboard title
- Clean up the realtime subscription on unmount

**No backend changes needed** — `sync-drgreen-data` edge function and realtime publication already exist.

---

## 2. Admin Clients Verification

The `AdminClientManager` component already fetches all clients from the Dr. Green API (up to 100 per page) and displays them with KYC and approval status badges. The `/admin/clients` page (`AdminClients.tsx`) renders this component. No code changes needed — this is a verification step during testing.

---

## 3. Email Logo Branding Fix

**File: `supabase/functions/drgreen-webhook/index.ts`**

Currently, emails reference `hb-logo-white.png` from the `email-assets` storage bucket. The fix:

- **Order confirmation email** (line 765): The header has a teal `#0d9488` background — keep using the white logo (`hb-logo-white.png`). This is correct.
- **Order status emails** (`getOrderStatusEmail` function, line 160-238): These use colored headers but have NO logo at all. Add the white logo `hb-logo-white.png` to the header section.
- **All emails**: Ensure the logo is sourced from `{supabaseUrl}/storage/v1/object/public/email-assets/hb-logo-white.png` for dark/teal backgrounds and `{supabaseUrl}/storage/v1/object/public/email-assets/hb-logo-teal.png` for light/white backgrounds (e.g. body sections).
- Upload the teal logo to the `email-assets` bucket if not already there (check first).

**Branding rules applied:**
- Dark/colored header → white logo (`hb-logo-white.png`)
- Light/white background sections → teal/green logo (`hb-logo-teal.png`)
- Footer section (light gray `#f4f4f5`) → teal logo

---

## 4. Webhook Test

After deployment, test by calling:
```
POST /functions/v1/drgreen-webhook
```
with a sample `order.confirmed` payload to verify the email renders with correct logos. This is a manual verification step.

---

## Technical Details

- Realtime subscription pattern:
```typescript
const channel = supabase
  .channel('admin-dashboard')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'drgreen_clients' }, () => refetch())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'drgreen_orders' }, () => refetch())
  .subscribe();
```
- The `sync-drgreen-data` function returns `{ success, clients: { fetched, upserted }, orders: { fetched, upserted } }` — display these in the toast
- Logo URLs use the public `email-assets` bucket, no auth needed

