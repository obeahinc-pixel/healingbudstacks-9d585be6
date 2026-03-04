

# Plan: Clean Up Dead Conversion Code + Fix Stale Comments

## What's happening now

- `convertFromEUR` and `convertFromZAR` are defined in `ShopContext.tsx` but **no component calls them** — they're dead code
- `useExchangeRates` hook and `updateCachedRates` are only used by `ShopContext.tsx` to feed these dead functions
- The `exchangeRates`, `convertFromEUR`, `convertFromZAR`, and `ratesLastUpdated` are exposed on the context interface but unused by consumers
- Two stale comments say "converted from EUR" in `StrainDetail.tsx` and `StrainQuickView.tsx`
- Prices display correctly as ZAR (R10,00 etc.) on the Lovable preview domain — `getCountryFromDomain()` returns `ZA` → `formatPrice` uses `en-ZA` locale with `ZAR` currency → correct

## Changes

### 1. Remove dead conversion code from `ShopContext.tsx`

- Remove `convertFromEUR` and `convertFromZAR` function definitions (lines 125-135)
- Remove `useExchangeRates` import and usage (line 4-5, 105)
- Remove `updateCachedRates` import and the `useEffect` that calls it (line 5, 116-120)
- Remove `ExchangeRatesData` interface (lines 30-36)
- Remove `COUNTRY_TO_CURRENCY` mapping (lines 68-74) — unused
- Remove `exchangeRates`, `convertFromEUR`, `convertFromZAR`, `ratesLastUpdated` from the context interface and provider value
- Keep `cartTotalConverted = cartTotal` (still referenced by `Cart.tsx`)

### 2. Fix stale comments

| File | Line | Change |
|------|------|--------|
| `src/pages/StrainDetail.tsx` | 268 | `{/* Price - converted from EUR */}` → `{/* Price - fixed local price from API */}` |
| `src/components/shop/StrainQuickView.tsx` | 186 | Same |
| `src/context/ShopContext.tsx` | 137 | Update comment to remove EUR reference |

### 3. Leave `useExchangeRates` hook and `currency.ts` utilities intact

These files remain — they may be useful for future features (e.g. admin comparison dashboards). Only the dead wiring in `ShopContext` is removed.

## Currency verification

The current flow is correct:
- `getCountryFromDomain()` → `ZA` for lovable.app / .co.za domains
- `formatPrice(amount, 'ZA')` → `getCurrencyForCountry('ZA')` → `ZAR` → `Intl.NumberFormat('en-ZA', { currency: 'ZAR' })` → **R10,00**
- For PT domains → EUR → €10.00, GB → GBP → £10.00, etc.

No currency bugs — prices are already displaying correctly in ZAR on the preview.

