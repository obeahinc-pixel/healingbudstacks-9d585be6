

# Dead Code Audit Results

## Confirmed Dead Code (Safe to Remove)

### 1. `src/hooks/useWalletAuth.ts` -- DEAD HOOK
Zero imports anywhere in the codebase. Not referenced by any component or page.

### 2. `src/components/shop/GeneratedProductImage.tsx` + `src/hooks/useGeneratedImage.ts` -- DEAD COMPONENT + HOOK
`GeneratedProductImage` is never imported outside its own file. `useGeneratedImage` is only imported by `GeneratedProductImage`. Both are dead.

### 3. `src/components/admin/SalesDashboard.tsx` -- DEAD COMPONENT
Never imported or rendered anywhere. Exports `SalesDashboard` but no file references it.

### 4. `src/components/ProtectedNFTRoute.tsx` -- DEAD COMPONENT (imported but unused)
Imported in `App.tsx` but never used in any `<Route>`. The import can be removed from `App.tsx` and the file deleted.

### 5. `supabase/functions/prescription-expiry-check/` -- DEAD EDGE FUNCTION
Zero references in `src/`. Only exists in `config.toml`. No frontend or backend code invokes it.

### 6. `supabase/functions/upload-email-logo/` -- DEAD EDGE FUNCTION
Zero references in `src/`. Never invoked by any component.

## Changes

| Action | File |
|--------|------|
| Delete | `src/hooks/useWalletAuth.ts` |
| Delete | `src/hooks/useGeneratedImage.ts` |
| Delete | `src/components/shop/GeneratedProductImage.tsx` |
| Delete | `src/components/admin/SalesDashboard.tsx` |
| Delete | `src/components/ProtectedNFTRoute.tsx` |
| Delete | `supabase/functions/prescription-expiry-check/` |
| Delete | `supabase/functions/upload-email-logo/` |
| Edit | `src/App.tsx` -- remove `ProtectedNFTRoute` import (line 16) |
| Edit | `supabase/config.toml` -- remove `[functions.prescription-expiry-check]` and `[functions.upload-email-logo]` blocks |

## Not Dead (Confirmed Active)
All other hooks, utilities, components, and edge functions have active import chains and are in use. No further removals recommended.

## Impact
- Removes ~7 dead files and 2 edge function deployments
- Cleans one unused import from `App.tsx`
- No functional change to the application

