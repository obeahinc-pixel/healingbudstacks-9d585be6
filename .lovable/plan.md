

# Plan: Fix Pricing (Local/Fixed) + Fix Cart DELETE

## Problem Summary

From the API response the user shared, orders have:
- `totalAmount`: the actual total (quantity × unit price, e.g. 90 = 2 × 45)
- `totalPrice`: the sum of unit prices (e.g. 45)

The current pricing system assumes the API returns EUR prices and applies `convertFromEUR()` everywhere. But the API now returns **fixed local prices** — the price is already in the correct currency for the queried region. This causes price fluctuation as exchange rates change.

Additionally, the `remove-from-cart` DELETE sends a JSON body, which the updated API doesn't expect.

## Changes

### 1. Flip price extraction priority — location price first

**`src/hooks/useProducts.ts`** (lines 182-187) and **`supabase/functions/sync-strains/index.ts`** (lines 230-235)

Current: `strain.retailPrice → strain.pricePerGram → strain.price → location.retailPrice`
New: `location.retailPrice → location.pricePerGram → location.pricePerUnit → strain.retailPrice → strain.pricePerGram → strain.price → 0`

The `strainLocations[0]` price is the fixed/local price for the queried country. It should take priority.

### 2. Remove `convertFromEUR()` from all price displays

The API returns local prices, so conversion is wrong. Change all calls from `convertFromEUR(product.retailPrice)` to just `product.retailPrice` in these 6 files:

| File | Lines (approx) |
|------|------|
| `src/components/FeaturedStrains.tsx` | line 117 |
| `src/components/shop/ProductCard.tsx` | line 167 |
| `src/components/shop/StrainQuickView.tsx` | lines 190, 303 |
| `src/pages/StrainDetail.tsx` | lines 272, 332 |
| `src/pages/Checkout.tsx` | lines 572, 576 |
| `src/components/shop/Cart.tsx` | (any convertFromEUR calls) |

Also update `ShopContext.tsx` line 137: `cartTotalConverted` should just equal `cartTotal` (no conversion needed since unit prices are already local).

### 3. Fix `remove-from-cart` DELETE — sign query string, no body

**`supabase/functions/drgreen-proxy/index.ts`** (lines 2128-2167)

Current: Signs `{ cartId }` as JSON body and sends it with DELETE.
Fix: Sign the query string `strainId=xxx` instead. Remove `body` from the fetch call.

### 4. Fix `empty-cart` DELETE — no body

**`supabase/functions/drgreen-proxy/index.ts`** (lines 2707-2718)

Current: `drGreenRequest` signs a body.
Fix: Use direct fetch with no body. Sign empty string for signature.

### 5. Update order sync mapping

**`src/hooks/useOrderTracking.ts`** (line 191)

The API returns `totalAmount` as the real total — this mapping is correct. No change needed here, but add `totalPrice` (base price) as a fallback: `live.totalAmount || live.totalPrice || live.total_amount || 0`.

## What stays the same
- `formatPrice()` still handles currency symbol/formatting based on country code
- The exchange rate infrastructure remains (may be useful for other features)
- Order display logic stays the same — `total_amount` in the DB is correct
- Dr. Green API URLs unchanged

