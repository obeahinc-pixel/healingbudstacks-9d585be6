

## Architectural Review: Webhook, Email Functions, and Redundancy Analysis

### The Core Question: Do We Need the Webhook?

**Yes, but for a different reason than strain matching.** The form/calculation logic (medical questionnaire → strain recommendation) is entirely frontend + proxy. The webhook serves a completely different purpose: **receiving push notifications from the Dr. Green API when external state changes** — things your app cannot know about without being told.

---

### What the Webhook Actually Does (882 lines)

The `drgreen-webhook` handles **6 categories of inbound events from Dr. Green's backend**:

| Event Category | What Triggers It | Can Your App Know Without a Webhook? |
|---|---|---|
| `kyc.verified` / `kyc.rejected` | FirstAML completes identity check | **No** — external system |
| `client.approved` / `client.rejected` | Dr. Green admin reviews patient | **No** — external decision |
| `order.confirmed` / `order.verified` | Dr. Green confirms payment received | **No** — external payment |
| `order.shipped` / `order.delivered` | Fulfilment partner updates shipment | **No** — external logistics |
| `payment.completed` / `payment.failed` | Payment gateway callback | **No** — external gateway |
| `inventory.*` / `stock.*` | Stock levels change at cultivation | **No** — external supply chain |

**Verdict: The webhook is essential.** These are all external events your app has no way to detect via polling or user input. The webhook is the only way to keep your local DB (`drgreen_clients`, `drgreen_orders`) synchronized with reality.

---

### The Real Problem: Duplicated Email Logic

You have **6 separate edge functions** that all send emails via Resend:

| Function | Purpose | Called From | Overlap? |
|---|---|---|---|
| `drgreen-webhook` | KYC/order status emails on API push events | Dr. Green API (external) | **Has its own inline email builder** |
| `send-order-confirmation` | Order confirmation email | `Checkout.tsx` (frontend) | **Duplicates webhook's order.confirmed email** |
| `send-onboarding-email` | Welcome email after signup | `Auth.tsx` (frontend) | Unique, but could be in `send-client-email` |
| `send-client-email` | KYC link, welcome, approval emails | `ClientOnboarding.tsx`, `AdminEmailTrigger.tsx` | **Duplicates webhook's kyc.* and client.* emails** |
| `send-dispatch-email` | Shipping notification | `useAdminOrderSync.ts` (admin action) | **Duplicates webhook's order.shipped email** |
| `send-contact-email` | Contact form submission | Contact page | Unique — no overlap |

**Conflicts found:**

1. **Order confirmation sent twice** — `Checkout.tsx` calls `send-order-confirmation` immediately, AND the webhook sends another confirmation when `order.confirmed` arrives from Dr. Green. Patient gets **2 emails**.

2. **KYC emails sent twice** — `ClientOnboarding.tsx` calls `send-client-email` with type `kyc-link` on registration, AND the webhook sends a KYC email when `kyc.link_generated` arrives. Patient gets **2 emails**.

3. **Shipping emails sent twice** — Admin clicks dispatch in `useAdminOrderSync` which calls `send-dispatch-email`, AND the webhook sends a shipping email when `order.shipped` arrives from Dr. Green.

---

### Proposed Architecture: Single Email Gateway

**Consolidate to 3 functions (down from 6):**

| Keep | Purpose | Why |
|---|---|---|
| `drgreen-webhook` | Receive external events, update DB, trigger emails | **Single source of truth for API-driven emails** |
| `send-client-email` | Manual admin-triggered emails + frontend onboarding | **Human-initiated emails only** |
| `send-contact-email` | Contact form | **Unrelated to patient lifecycle** |

| Remove / Deprecate | Reason |
|---|---|
| `send-order-confirmation` | Webhook handles this via `order.confirmed` event |
| `send-dispatch-email` | Webhook handles this via `order.shipped` event |
| `send-onboarding-email` | Merge into `send-client-email` as type `welcome` |

**Decision rule:** If Dr. Green API will push the event → let the webhook handle the email. If it's a human action (admin trigger, contact form, signup) → use the dedicated function.

---

### Frontend Changes Required

1. **`Checkout.tsx` (line 86):** Remove `send-order-confirmation` call. The order is created via `drgreen-proxy`, Dr. Green API will push `order.confirmed` back through the webhook, which sends the email. Show a toast: "Order placed — confirmation email will arrive shortly."

2. **`ClientOnboarding.tsx` (line 837):** Remove the KYC email call. The webhook handles `kyc.link_generated`. Keep the welcome email call (line 817) since that's user-initiated.

3. **`useAdminOrderSync.ts` (line 414):** Remove `send-dispatch-email` call. The webhook handles `order.shipped`. If admin needs to manually dispatch without Dr. Green knowing, keep it as a fallback with a "manual override" flag.

4. **`Auth.tsx` (line 249):** Move `send-onboarding-email` to call `send-client-email` with type `welcome` instead.

---

### Resend: Still Needed

**Yes, Resend is required.** All transactional emails (order confirmations, KYC notifications, shipping updates) are non-auth emails. Lovable's built-in email system only handles auth emails (password reset, magic links). Resend is the correct tool for transactional/lifecycle emails.

**Current Resend setup is correct:**
- Region-specific send domains (`send.healingbuds.co.za`, `send.healingbuds.pt`, `send.healingbuds.co.uk`)
- `RESEND_API_KEY` stored as a secret
- Branded HTML templates with correct logo rules

---

### Other Improvements

1. **Dead code:** `exchange-rates` edge function exists but is unused — delete it
2. **Logo inconsistency:** `send-order-confirmation` still uses old `hb-logo-white.png` (line 51) instead of `hb-logo-white-full.png`
3. **Realtime publication:** Need to verify `drgreen_clients` and `drgreen_orders` are in `supabase_realtime` publication for the admin dashboard "Live" indicator to work
4. **`WEBHOOK_TEST_SECRET`:** Still not configured — blocks all webhook testing

---

### Summary

```text
CURRENT STATE:
  6 email functions → duplicate emails sent to patients
  Webhook + frontend both trigger same emails

PROPOSED STATE:
  3 email functions → single source of truth per event type
  Webhook owns API-driven emails
  Frontend owns human-initiated emails only

KEEP:     drgreen-webhook, send-client-email, send-contact-email
REMOVE:   send-order-confirmation, send-dispatch-email, send-onboarding-email
STILL NEED: Resend (for all transactional emails)
STILL NEED: Webhook (for external API push events)
```

### Single Next Action

**Deduplicate the email pipeline** — remove the 3 redundant email functions and update the 3 frontend call sites to stop double-sending. This eliminates the "patient gets 2 emails" bug before it hits production.

