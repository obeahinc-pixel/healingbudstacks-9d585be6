import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OnboardingEmailRequest {
  email: string;
  firstName?: string;
  fullName?: string;
  region?: string;
}

function getSendDomain(region?: string): string {
  const map: Record<string, string> = {
    ZA: 'send.healingbuds.co.za',
    PT: 'send.healingbuds.pt',
    GB: 'send.healingbuds.co.uk',
  };
  return map[region?.toUpperCase() || ''] || 'send.healingbuds.co.za';
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-onboarding-email] Request received");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, fullName, region }: OnboardingEmailRequest = await req.json();

    if (!email) {
      console.error("[send-onboarding-email] Missing email");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("[send-onboarding-email] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract first name from fullName if firstName not provided
    const displayName = firstName || (fullName ? fullName.split(" ")[0] : null);
    const greeting = displayName ? `Hi ${displayName}` : "Hi there";

    console.log(`[send-onboarding-email] Sending to ${email}`);

    const siteUrl = Deno.env.get("SITE_URL") || "https://healingbuds.co.za";
    const registrationUrl = `${siteUrl}/shop/register`;
    const logoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/email-assets/hb-logo-teal.png`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Healing Buds</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; text-align: center; border-radius: 12px 12px 0 0; border-bottom: 3px solid #0d5c4d;">
              <img src="${logoUrl}" alt="Healing Buds" width="200" style="display: block; margin: 0 auto; max-width: 200px; height: auto;" />
              <p style="color: #0d5c4d; margin: 16px 0 0 0; font-size: 14px; font-weight: 500;">
                Medical Cannabis Care
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #0d5c4d; margin: 0 0 20px 0; font-size: 24px;">
                ${greeting}, Welcome! 🎉
              </h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for creating your Healing Buds account. You're one step away from accessing our medical cannabis dispensary.
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                <strong>Next Step:</strong> Complete your patient registration to verify your eligibility. This includes a brief medical questionnaire and identity verification (KYC).
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${registrationUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #0d5c4d 0%, #1a7a6d 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(13, 92, 77, 0.3);">
                      Complete Your Registration →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                Or copy this link into your browser:<br>
                <a href="${registrationUrl}" style="color: #0d5c4d; word-break: break-all;">${registrationUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- What to Expect Section -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <div style="background-color: #f0fdf4; border-left: 4px solid #0d5c4d; padding: 20px; border-radius: 0 8px 8px 0;">
                <h3 style="color: #0d5c4d; margin: 0 0 12px 0; font-size: 16px;">What to Expect:</h3>
                <ul style="color: #374151; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                  <li>Brief medical questionnaire (2-3 minutes)</li>
                  <li>Identity verification for compliance</li>
                  <li>Access to our full range of medical cannabis products</li>
                  <li>Personalized strain recommendations</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 10px 0; text-align: center;">
                Need help? Contact our support team at<br>
                <a href="mailto:support@healingbuds.co.za" style="color: #0d5c4d;">support@healingbuds.co.za</a>
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} Healing Buds. All rights reserved.<br>
                This is a transactional email related to your account.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send via Resend API using fetch
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Healing Buds <noreply@${getSendDomain(region)}>`,
        to: [email],
        subject: "Welcome to Healing Buds - Complete Your Registration",
        html: emailHtml,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[send-onboarding-email] Resend API error:", data);
      // Return success: false but 200 status - don't block registration
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to send email' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[send-onboarding-email] Email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    // Log error but don't crash - this should never block user registration
    console.error("[send-onboarding-email] Error:", error.message);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
