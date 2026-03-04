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
    const { email, password, verify, action, userId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Handle delete action
    if (action === 'delete' && userId) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        throw new Error(`Failed to delete user: ${deleteError.message}`);
      }
      return new Response(
        JSON.stringify({ success: true, message: "User deleted successfully", userId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email) {
      throw new Error("Email is required");
    }

    // Find user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    let user = users.find(u => u.email === email);
    
    // If user doesn't exist, create them
    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || "temp12345",
        email_confirm: verify || false,
      });
      
      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "User created successfully",
          user: {
            id: newUser.user.id,
            email: newUser.user.email,
            email_confirmed_at: newUser.user.email_confirmed_at
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update existing user
    const updateData: Record<string, unknown> = {};
    if (password) updateData.password = password;
    if (verify) updateData.email_confirm = true;

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      updateData
    );

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User updated successfully",
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          email_confirmed_at: updatedUser.user.email_confirmed_at
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
