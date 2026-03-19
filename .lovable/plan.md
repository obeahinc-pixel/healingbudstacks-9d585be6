

## Plan: Reset Passwords and Diagnose Email Delivery

### Step 1: Force password reset for both accounts
Call the `admin-update-user` edge function twice:
- `varseainc@gmail.com` → password `12345678`
- `maykendaal23@gmail.com` → password `12345678`

No code changes needed — uses existing edge function.

### Step 2: Verify login works
Test that both accounts can sign in with the new password by checking auth logs.

### Step 3: Diagnose password reset email delivery
- Check current email domain status using the email domain tools
- The project has a `RESEND_API_KEY` secret configured, which suggests Resend was set up at some point
- Determine whether auth email templates (password reset, verification) are scaffolded and deployed
- If no email domain is configured, set up the email infrastructure so reset emails actually send

### Expected outcome
- Both accounts login with `12345678`
- Clear diagnosis of why reset emails don't send, with a fix applied or next steps identified

### Technical details
| Account | User ID | Action |
|---------|---------|--------|
| `varseainc@gmail.com` | `bf9dd80c-1a3c-4d95-9a76-bc70498f7b61` | Set password |
| `maykendaal23@gmail.com` | (lookup needed) | Set password |
| Email domain | Check status | Diagnose delivery |

