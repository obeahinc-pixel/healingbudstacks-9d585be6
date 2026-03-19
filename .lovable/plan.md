
# Plan: Seamless Single-Flow Customer Signup

## Problem
The current signup experience is fragmented and feels "buggy":
1. User signs up at `/auth` -- sees "account created, check your email"
2. User confirms email, comes BACK to `/auth`, logs in
3. Gets redirected to `/shop/register` which shows a separate "Welcome" banner + registration form
4. On the shop page (`/shop`), the `EligibilityGate` shows a "Complete Registration" button that links back to `/shop/register` -- this looks like a broken loop

The user has to navigate through 3 different pages and click "Complete Registration" to even start the medical form. It should feel like one continuous onboarding journey.

## Solution: Merge Signup + Registration Into One Seamless Flow

### Change 1: Auto-redirect after login to registration inline
**File: `src/pages/Auth.tsx`** (lines 86-109)

After a new user logs in (no `drGreenClient`), instead of redirecting to `/shop/register` which loads a whole new page with its own header/banner, redirect directly and immediately. The redirect is already working, but the target page (`ShopRegister`) feels disconnected.

**Action**: No change needed here -- the redirect logic is correct.

### Change 2: Remove the "Sign In to Continue" dead-end from ShopRegister
**File: `src/pages/ShopRegister.tsx`** (lines 179-196)

The unauthenticated state shows a static card with "Sign In to Continue" and a button. This is fine but the Loader2 icon (spinning) in the card is confusing -- it looks like something is loading when nothing is happening. Replace with a proper icon (e.g., a lock or user icon).

### Change 3: Streamline the ShopRegister welcome banner
**File: `src/pages/ShopRegister.tsx`** (lines 164-178)

The welcome banner adds vertical space before the form and separates the experience. Merge this messaging into the ClientOnboarding component's first step header so users see the form immediately without scrolling.

**Action**: Remove the separate welcome banner div. Instead, add welcome text as a subtitle in the ClientOnboarding personal details card header.

### Change 4: Make the EligibilityGate less alarming for new users
**File: `src/components/shop/EligibilityGate.tsx`**

Currently shows "No Medical Profile Found" with a scary shield icon and 4-step progress tracker before showing a "Start Registration" button. For brand-new users this is overwhelming and feels like an error.

**Action**: Simplify the no-client state to a friendly, minimal prompt -- a single card with welcoming language and one clear CTA button. Remove the multi-step tracker from the EligibilityGate (it's already shown inside the registration form and on the status page).

### Change 5: Pre-fill email from auth session in ClientOnboarding
**File: `src/components/shop/ClientOnboarding.tsx`** (lines 369-379)

Currently the email field starts empty, forcing the user to re-type their email (which they just used to sign up). Pre-fill it from the authenticated user's email.

**Action**: On mount, fetch `supabase.auth.getUser()` and set the email + name defaults from the user metadata. Also make the email field read-only since it must match the auth email.

### Change 6: Simplify the ClientOnboarding progress bar for mobile
**File: `src/components/shop/ClientOnboarding.tsx`** (lines 937-977)

The 6-step progress indicator with icons and labels is cluttered on mobile (labels hidden). Simplify to show step X of Y with a clean progress bar.

**Action**: Show "Step X of Y" text above the progress bar. Keep the progress bar. Remove the individual step icons on mobile (they're already hidden via `hidden sm:block`).

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/ShopRegister.tsx` | Remove separate welcome banner, fix unauthenticated state icon, tighten layout |
| `src/components/shop/EligibilityGate.tsx` | Simplify no-client state to friendly single CTA card |
| `src/components/shop/ClientOnboarding.tsx` | Pre-fill email/name from auth session, add welcome subtitle to step 1, add "Step X of Y" label |

## What This Does NOT Change
- The actual signup/login at `/auth` stays the same
- The medical questionnaire steps and validation stay the same
- The Dr. Green API integration stays the same
- The completion step with "What happens next" stays the same
- The DashboardStatus page stays the same
- KYC is still not blocking -- it just sends the email after registration

---

# Completed: Account Password Resets (2026-03-19)

## ✅ Passwords Reset Successfully
| Account | User ID | Status |
|---------|---------|--------|
| `varseainc@gmail.com` | `bf9dd80c-1a3c-4d95-9a76-bc70498f7b61` | Password set to `12345678` ✅ |
| `maykendaal23@gmail.com` | `8e7da277-fc78-414b-827b-0ac139ceae3f` | Password set to `12345678` ✅ |

Both accounts are email-confirmed and can now login with password `12345678`.

## 🔍 Email Delivery Diagnosis
**Root cause: No email domain is configured.**

Despite having a `RESEND_API_KEY` secret, no email domain has been set up in the project. This means:
- Password reset emails cannot be sent from a verified sender
- Default auth emails may land in spam or be silently dropped by Gmail
- The `RESEND_API_KEY` is unused without domain configuration

### Fix Required
Set up an email domain (e.g., `notify.healingbuds.co.za`) to enable reliable auth email delivery. This requires:
1. Configuring the email domain in Cloud → Emails
2. Adding DNS records (NS delegation) at the domain registrar
3. Scaffolding auth email templates
4. Deploying the `auth-email-hook` edge function
