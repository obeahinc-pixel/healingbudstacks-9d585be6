

## Plan: Fix Password Reset Redirect + Add Password Visibility Toggle

### Problem 1: Reset redirect URL
Currently `getProductionPath('/auth')` uses `window.location.origin` which in the preview returns the Lovable preview URL, not `healingbuds.co.za`. The reset email link needs to always point to the production domain.

**Fix:** Hardcode the production redirect URL for password reset to `https://healingbuds.co.za/auth` in the `handleForgotPassword` function, instead of using the dynamic `getProductionPath`.

### Problem 2: No password visibility toggle
All 4 password fields (login password, signup password, confirm password, new password, confirm new password) use `type="password"` with no toggle.

**Fix:** Add state variables for password visibility and eye/eye-off toggle buttons on all password inputs.

### Changes (1 file)

**`src/pages/Auth.tsx`**
1. Import `Eye`, `EyeOff` from lucide-react
2. Add visibility state: `showPassword`, `showConfirmPassword`, `showNewPassword`, `showConfirmNewPassword`
3. Change `handleForgotPassword` redirect URL from `getProductionPath('/auth')` to `'https://healingbuds.co.za/auth'`
4. Add toggle button (absolute positioned right side) on all 5 password inputs, switching between `type="password"` and `type="text"`

