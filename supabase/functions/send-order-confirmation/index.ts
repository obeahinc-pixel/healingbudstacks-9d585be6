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

interface OrderConfirmationRequest {
  email: string;
  customerName: string;
  orderId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  shippingAddress: ShippingAddress;
  isLocalOrder: boolean;
  region?: string;
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

function buildEmailHtml(req: OrderConfirmationRequest, config: { brandName: string; supportEmail: string }) {
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

  const statusBanner = req.isLocalOrder
    ? `<div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">⏳ Order Queued for Processing</p>
        <p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;">
          Your order has been received and saved securely. Our team will process it and confirm via email. No payment has been taken yet.
        </p>
      </div>`
    : `<div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; color: #16a34a; font-size: 18px; font-weight: 600;">✓ Order Confirmed</p>
      </div>`;

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
      <p style="color: #18181b; font-size: 16px; line-height: 1.6;">
        Thank you for your order with ${config.brandName}. Here are your order details:
      </p>

      ${statusBanner}

      <p style="color: #71717a; font-size: 13px; margin: 0 0 4px 0;">Reference</p>
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
        <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px; text-transform: uppercase;">Shipping Address</p>
        <p style="margin: 0; color: #18181b; font-size: 14px; line-height: 1.6;">
          ${addr.address1}${addr.address2 ? "<br>" + addr.address2 : ""}<br>
          ${addr.city}${addr.state ? ", " + addr.state : ""} ${addr.postalCode}<br>
          ${addr.country}
        </p>
      </div>

      <p style="color: #71717a; font-size: 13px; line-height: 1.6;">
        If you have any questions about your order, please contact us at
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
    // Auth check
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[send-order-confirmation] Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const request: OrderConfirmationRequest = await req.json();
    console.log("[send-order-confirmation] Request:", { orderId: request.orderId, email: request.email, isLocal: request.isLocalOrder });

    if (!request.email || !request.orderId || !request.items?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("[send-order-confirmation] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "Email service not configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const config = getDomainConfig(request.region);
    const html = buildEmailHtml(request, config);

    const subject = request.isLocalOrder
      ? `Order Received - ${request.orderId} | ${config.brandName}`
      : `Order Confirmed - ${request.orderId} | ${config.brandName}`;

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
      console.error("[send-order-confirmation] Resend error:", data);
      return new Response(JSON.stringify({ success: false, error: data.message }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[send-order-confirmation] Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-order-confirmation] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
