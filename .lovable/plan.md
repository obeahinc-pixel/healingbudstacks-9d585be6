

# Plan: Test Full Signup Flow + Region-Aware Email Domains

## Task 1: Fix and Test Full Signup Flow

The signup flow (Auth.tsx -> ShopRegister.tsx -> ClientOnboarding.tsx) is architecturally sound. The flow is:
1. User signs up at `/auth` (email + password + full name)
2. Non-blocking onboarding email sent via `send-onboarding-email`
3. User confirms email, logs in, navigates to `/shop/register`
4. `ClientOnboarding` 5-step form: Personal -> Address -> Business -> Medical History -> Medical Info -> Complete
5. On final submit, calls `drgreen-proxy` with `create-client-legacy` action
6. Stores result in `drgreen_clients` table, sends welcome + KYC emails

**No code-level errors found in the signup flow.** The architecture is correct -- existing client detection, API payload building, error handling, and fallback logic are all properly implemented.

To verify the flow works end-to-end, I will use browser automation to walk through the signup as a new user after implementing the email changes.

## Task 2: Update All Email Edge Functions to Use Region-Aware From Domains

Currently, all 5 email edge functions hardcode the `from` address to `noreply@send.healingbuds.co.za` regardless of region. Each function already receives a `region` parameter and has domain config -- we just need to wire the `from` address to use the correct regional send domain.

### Regional Domain Mapping
| Region | From Domain |
|--------|-------------|
| ZA | `send.healingbuds.co.za` |
| PT | `send.healingbuds.pt` |
| GB | `send.healingbuds.co.uk` |
| global (fallback) | `send.healingbuds.co.za` |

### Also: Standardize PT support email to English
Per the memory note, all support emails should use English (e.g., `support@healingbuds.pt` not `suporte@healingbuds.pt`). Two functions (`send-client-email` and `send-dispatch-email`) still use `suporte@healingbuds.pt`.

### Files to Change

**1. `supabase/functions/send-order-confirmation/index.ts`** (line 193)
- Change: `from: \`\${config.brandName} <noreply@send.healingbuds.co.za>\``
- To: Use region-aware domain from a helper function
- Also fix PT support email from `suporte` to `support`

**2. `supabase/functions/send-onboarding-email/index.ts`** (line ~130)
- Currently hardcoded: `from: "Healing Buds <noreply@send.healingbuds.co.za>"`
- This function doesn't receive a `region` parameter -- needs adding
- Frontend call in `Auth.tsx` (line 237-243) doesn't pass region -- will need to pass it or default to ZA

**3. `supabase/functions/send-client-email/index.ts`** (line 338)
- Change: `const fromAddress = \`\${domainConfig.brandName} <noreply@send.healingbuds.co.za>\``
- To: Use `send.${domainConfig.domain}` pattern
- Fix PT `suporte` -> `support`

**4. `supabase/functions/send-dispatch-email/index.ts`** (line 214)
- Change: `from: \`\${config.brandName} <noreply@send.healingbuds.co.za>\``
- To: Use region-aware domain
- Fix PT `suporte` -> `support`

**5. `supabase/functions/send-contact-email/index.ts`** (line ~130)
- Currently hardcoded: `from: "Healing Buds <noreply@send.healingbuds.co.za>"`
- No region parameter -- contact form is global, so will default to `.co.za`

### Implementation Pattern

Each function that has `DOMAIN_CONFIG` will get a `sendDomain` field added:

```text
ZA: { ..., sendDomain: 'send.healingbuds.co.za' }
PT: { ..., sendDomain: 'send.healingbuds.pt', supportEmail: 'support@healingbuds.pt' }
GB: { ..., sendDomain: 'send.healingbuds.co.uk' }
global: { ..., sendDomain: 'send.healingbuds.co.za' }
```

Then the `from` address becomes: `` `${config.brandName} <noreply@${config.sendDomain}>` ``

For `send-onboarding-email` (no DOMAIN_CONFIG), a simple mapping function will be added based on a `region` parameter.

### Frontend Change

**`src/pages/Auth.tsx`** (line 237-243): Pass region to onboarding email. Since we don't know the user's region at signup time, we'll default to `'ZA'` (matching the platform's ZA fallback).

### Deployment

All 5 edge functions will be redeployed after changes.

