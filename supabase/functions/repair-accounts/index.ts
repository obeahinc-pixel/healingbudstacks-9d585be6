import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Step 1: Get all drgreen_clients with email but no user_id
    const { data: unlinkedClients, error: fetchErr } = await supabaseAdmin
      .from("drgreen_clients")
      .select("id, email, drgreen_client_id, full_name")
      .is("user_id", null)
      .not("email", "is", null);

    if (fetchErr) throw new Error(`Fetch unlinked clients: ${fetchErr.message}`);

    const results = {
      total_unlinked: unlinkedClients?.length || 0,
      linked_existing: 0,
      accounts_created: 0,
      reset_emails_sent: 0,
      errors: [] as string[],
    };

    if (!unlinkedClients?.length) {
      // Also try to backfill: find auth users whose email matches unlinked clients
      await backfillExistingUsers(supabaseAdmin, results);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: For each unlinked client, check if auth user exists
    const { data: { users: allUsers }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw new Error(`List users: ${listErr.message}`);

    const usersByEmail = new Map(allUsers.map(u => [u.email?.toLowerCase(), u]));

    for (const client of unlinkedClients) {
      if (!client.email) continue;
      const email = client.email.toLowerCase();

      try {
        const existingUser = usersByEmail.get(email);

        if (existingUser) {
          // Link existing auth user to this client record
          const { error: linkErr } = await supabaseAdmin
            .from("drgreen_clients")
            .update({ user_id: existingUser.id, updated_at: new Date().toISOString() })
            .eq("id", client.id);

          if (linkErr) {
            results.errors.push(`Link ${email}: ${linkErr.message}`);
          } else {
            results.linked_existing++;
          }

          // Also link unlinked orders
          await supabaseAdmin
            .from("drgreen_orders")
            .update({ user_id: existingUser.id, updated_at: new Date().toISOString() })
            .eq("customer_email", email)
            .is("user_id", null);

        } else {
          // Create new auth account (auto-confirmed, random password)
          const tempPassword = crypto.randomUUID() + "Aa1!";
          const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: client.full_name || "" },
          });

          if (createErr) {
            results.errors.push(`Create ${email}: ${createErr.message}`);
            continue;
          }

          results.accounts_created++;

          // Link client record
          const { error: linkErr } = await supabaseAdmin
            .from("drgreen_clients")
            .update({ user_id: newUser.user.id, updated_at: new Date().toISOString() })
            .eq("id", client.id);

          if (linkErr) {
            results.errors.push(`Link new ${email}: ${linkErr.message}`);
          }

          // Link unlinked orders
          await supabaseAdmin
            .from("drgreen_orders")
            .update({ user_id: newUser.user.id, updated_at: new Date().toISOString() })
            .eq("customer_email", email)
            .is("user_id", null);

          // Send password reset email so user can set their own password
          const { error: resetErr } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo: "https://healingbuds.co.za/auth" },
          });

          if (resetErr) {
            results.errors.push(`Reset email ${email}: ${resetErr.message}`);
          } else {
            results.reset_emails_sent++;
          }
        }
      } catch (err) {
        results.errors.push(`${email}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    // Also run backfill for any other edge cases
    await backfillExistingUsers(supabaseAdmin, results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("repair-accounts error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function backfillExistingUsers(supabaseAdmin: any, results: any) {
  // Find drgreen_orders with email but no user_id and try to match auth users
  const { data: unlinkedOrders } = await supabaseAdmin
    .from("drgreen_orders")
    .select("id, customer_email")
    .is("user_id", null)
    .not("customer_email", "is", null);

  if (!unlinkedOrders?.length) return;

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  const byEmail = new Map(users.map((u: any) => [u.email?.toLowerCase(), u]));

  for (const order of unlinkedOrders) {
    const user = byEmail.get(order.customer_email?.toLowerCase());
    if (user) {
      await supabaseAdmin
        .from("drgreen_orders")
        .update({ user_id: user.id, updated_at: new Date().toISOString() })
        .eq("id", order.id);
    }
  }
}
