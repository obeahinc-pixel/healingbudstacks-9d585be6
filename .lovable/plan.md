

## Plan: Update `auto_assign_admin_role()` Trigger

### Current state
- `healingbudsglobal@gmail.com` (user `1523a97a`) is the only admin in `user_roles` — confirmed.
- The `auto_assign_admin_role()` function still references `scott@healingbuds.global` alongside `healingbudsglobal@gmail.com`.

### Change
One database migration to replace the function body, removing `scott@healingbuds.global` from the hardcoded list:

```sql
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'healingbudsglobal@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
```

No other files or tables are affected. The existing admin session for `healingbudsglobal@gmail.com` is untouched.

