import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OrderItem {
  strain_name: string;
  quantity: number;
  unit_price: number;
}

interface ShippingAddress {
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

interface DispatchEmailRequest {
  email: string;
  customerName: string;
  orderId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  shippingAddress: ShippingAddress;
  trackingNumber?: string;
  estimatedDelivery?: string;
  region?: string;
  clientId?: string;
}

const DOMAIN_CONFIG: Record<string, { brandName: string; supportEmail: string; sendDomain: string }> = {
  ZA: { brandName: "Healing Buds South Africa", supportEmail: "support@healingbuds.co.za", sendDomain: "send.healingbuds.co.za" },
  PT: { brandName: "Healing Buds Portugal", supportEmail: "support@healingbuds.pt", sendDomain: "send.healingbuds.pt" },
  GB: { brandName: "Healing Buds UK", supportEmail: "support@healingbuds.co.uk", sendDomain: "send.healingbuds.co.uk" },
  global: { brandName: "Healing Buds", supportEmail: "support@healingbuds.global", sendDomain: "send.healingbuds.co.za" },
};

function getDomainConfig(region?: string) {
  return DOMAIN_CONFIG[region?.toUpperCase() || "global"] || DOMAIN_CONFIG.global;
}

function buildDispatchEmailHtml(req: DispatchEmailRequest, config: { brandName: string; supportEmail: string }) {
  const firstName = req.customerName.split(" ")[0] || req.customerName;
  const logoUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/email-assets/hb-logo-white.png`;
  const currencySymbol = req.currency === "ZAR" ? "R" : req.currency === "GBP" ? "£" : "€";

  const itemRows = req.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; font-size: 14px;">${item.strain_name}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; font-size: 14px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; font-size: 14px; text-align: right;">${currencySymbol}${(item.unit_price * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const trackingSection = req.trackingNumber
    ? `<div style="background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px; font-weight: 600;">📦 Tracking Information</p>
        <p style="margin: 0; color: #1e40af; font-size: 15px; font-family: monospace; font-weight: 600;">${req.trackingNumber}</p>
      </div>`
    : "";

  const estimatedDeliverySection = req.estimatedDelivery
    ? `<p style="color: #18181b; font-size: 14px; line-height: 1.6;">
        <strong>Estimated Delivery:</strong> ${req.estimatedDelivery}
      </p>`
    : "";

  const addr = req.shippingAddress;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background-color: #0d9488; padding: 24px; text-align: center;">
      <img src="${logoUrl}" alt="${config.brandName}" width="180" style="display: inline-block; max-width: 180px; height: auto;" />
      <p style="color: #ffffff; margin: 12px 0 0 0; font-size: 14px;">Medical Cannabis Care</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #18181b; font-size: 16px; line-height: 1.6;">Dear ${firstName},</p>

      <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; color: #16a34a; font-size: 18px; font-weight: 600;">🚚 Your Order Has Been Dispatched!</p>
      </div>

      <p style="color: #18181b; font-size: 16px; line-height: 1.6;">
        Great news! Your order with ${config.brandName} has been shipped and is on its way to you.
      </p>

      ${trackingSection}
      ${estimatedDeliverySection}

      <p style="color: #71717a; font-size: 13px; margin: 0 0 4px 0;">Order Reference</p>
      <p style="color: #18181b; font-size: 18px; font-family: monospace; margin: 0 0 24px 0; font-weight: 600;">${req.orderId}</p>

      <table width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e7eb;">
            <th style="text-align: left; padding: 8px 0; color: #71717a; font-size: 12px; text-transform: uppercase;">Product</th>
            <th style="text-align: center; padding: 8px 0; color: #71717a; font-size: 12px; text-transform: uppercase;">Qty</th>
            <th style="text-align: right; padding: 8px 0; color: #71717a; font-size: 12px; text-transform: uppercase;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr>
            <td colspan="2" style="padding: 12px 0; font-weight: 700; color: #18181b; font-size: 16px;">Total</td>
            <td style="padding: 12px 0; font-weight: 700; color: #0d9488; font-size: 16px; text-align: right;">${currencySymbol}${req.totalAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px; text-transform: uppercase;">Shipping To</p>
        <p style="margin: 0; color: #18181b; font-size: 14px; line-height: 1.6;">
          ${addr.address1}${addr.address2 ? "<br>" + addr.address2 : ""}<br>
          ${addr.city}${addr.state ? ", " + addr.state : ""} ${addr.postalCode}<br>
          ${addr.country}
        </p>
      </div>

      <p style="color: #71717a; font-size: 13px; line-height: 1.6;">
        If you have any questions about your delivery, please contact us at
        <a href="mailto:${config.supportEmail}" style="color: #0d9488;">${config.supportEmail}</a>.
      </p>
    </div>
    <div style="background-color: #f4f4f5; padding: 20px; text-align: center;">
      <p style="margin: 0; color: #71717a; font-size: 12px;">${config.brandName}</p>
      <p style="margin: 8px 0 0 0; color: #a1a1aa; font-size: 11px;">
        This is a transactional email regarding your order. © ${new Date().getFullYear()}
      </p>
    </div>
  </div>
</body>
</html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("[send-dispatch-email] Auth failed:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const request: DispatchEmailRequest = await req.json();
    console.log("[send-dispatch-email] Request:", {
      orderId: request.orderId,
      email: request.email,
      trackingNumber: request.trackingNumber || "none",
    });

    if (!request.email || !request.orderId || !request.items?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, orderId, items" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("[send-dispatch-email] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "Email service not configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const config = getDomainConfig(request.region);
    const html = buildDispatchEmailHtml(request, config);

    const subject = `Your Order Has Been Shipped - ${request.orderId} | ${config.brandName}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${config.brandName} <noreply@${config.sendDomain}>`,
        to: [request.email.trim()],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[send-dispatch-email] Resend error:", data);
      return new Response(JSON.stringify({ success: false, error: data.message }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[send-dispatch-email] Email sent successfully:", data);

    // Log to kyc_journey_logs if clientId provided
    if (request.clientId) {
      try {
        const userId = claimsData.claims.sub;
        await supabase.from("kyc_journey_logs").insert({
          user_id: userId,
          client_id: request.clientId,
          event_type: "email.requested",
          event_source: "server",
          event_data: { type: "dispatch", orderId: request.orderId, trackingNumber: request.trackingNumber },
        });
      } catch (logErr) {
        console.warn("[send-dispatch-email] Failed to log event:", logErr);
      }
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-dispatch-email] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
