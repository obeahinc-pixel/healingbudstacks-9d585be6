import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Multi-domain configuration for Healing Buds regions
const DOMAIN_CONFIG: Record<string, {
  domain: string;
  brandName: string;
  supportEmail: string;
  sendDomain: string;
  address: string;
  phone: string;
  websiteUrl: string;
}> = {
  'ZA': {
    domain: 'healingbuds.co.za',
    brandName: 'Healing Buds South Africa',
    supportEmail: 'support@healingbuds.co.za',
    sendDomain: 'send.healingbuds.co.za',
    address: '123 Sandton Drive, Sandton 2196, South Africa',
    phone: '+27 11 123 4567',
    websiteUrl: 'https://healingbuds.co.za',
  },
  'PT': {
    domain: 'healingbuds.pt',
    brandName: 'Healing Buds Portugal',
    supportEmail: 'support@healingbuds.pt',
    sendDomain: 'send.healingbuds.pt',
    address: 'Avenida D. João II, 98 A, 1990-100 Lisboa, Portugal',
    phone: '+351 210 123 456',
    websiteUrl: 'https://healingbuds.pt',
  },
  'GB': {
    domain: 'healingbuds.co.uk',
    brandName: 'Healing Buds UK',
    supportEmail: 'support@healingbuds.co.uk',
    sendDomain: 'send.healingbuds.co.uk',
    address: '123 Harley Street, London W1G 6AX, United Kingdom',
    phone: '+44 20 7123 4567',
    websiteUrl: 'https://healingbuds.co.uk',
  },
  'global': {
    domain: 'healingbuds.global',
    brandName: 'Healing Buds',
    supportEmail: 'support@healingbuds.global',
    sendDomain: 'send.healingbuds.co.za',
    address: 'Global Medical Cannabis Network',
    phone: '+27 11 123 4567',
    websiteUrl: 'https://healingbuds.global',
  },
};

function getDomainConfig(region?: string) {
  const regionKey = region?.toUpperCase() || 'global';
  return DOMAIN_CONFIG[regionKey] || DOMAIN_CONFIG['global'];
}

interface ClientEmailRequest {
  type: 'welcome' | 'kyc-link' | 'kyc-approved' | 'kyc-rejected' | 'eligibility-approved' | 'eligibility-rejected';
  email: string;
  name: string;
  region?: string;
  kycLink?: string;
  clientId?: string;
  rejectionReason?: string;
}

// Email templates
function getEmailTemplate(request: ClientEmailRequest, config: typeof DOMAIN_CONFIG['global']) {
  const { type, name, kycLink, rejectionReason } = request;
  const firstName = name.split(' ')[0] || name;

  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #f4f4f5;
    margin: 0;
    padding: 20px;
  `;

  const headerColor = type.includes('rejected') ? '#ef4444' : '#0d9488';

  // Logo URL hosted in Supabase storage
  const logoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/email-assets/hb-logo-white.png`;

  const templates: Record<string, { subject: string; body: string }> = {
    'welcome': {
      subject: `Welcome to ${config.brandName} - Registration Complete`,
      body: `
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Dear ${firstName},
        </p>
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Thank you for registering with ${config.brandName}. Your medical cannabis patient registration has been received.
        </p>
        <h3 style="color: #18181b; font-size: 18px; margin: 24px 0 12px 0;">What happens next?</h3>
        <ol style="color: #18181b; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong>Identity Verification (KYC)</strong> - You'll receive a separate email with a link to verify your identity.</li>
          <li><strong>Medical Review</strong> - Our medical team will review your application.</li>
          <li><strong>Approval</strong> - Once approved, you'll have full access to our medical cannabis products.</li>
        </ol>
        ${kycLink ? `
          <div style="text-align: center; margin: 32px 0;">
            <a href="${kycLink}" style="display: inline-block; background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
              Complete Identity Verification
            </a>
          </div>
        ` : `
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>Note:</strong> Your verification link is being generated and will be sent to you shortly in a separate email.
            </p>
          </div>
        `}
      `,
    },
    'kyc-link': {
      subject: `Complete Your Identity Verification - ${config.brandName}`,
      body: `
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Dear ${firstName},
        </p>
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Please complete your identity verification to continue with your ${config.brandName} registration.
        </p>
        <div style="background-color: #f0fdfa; border: 1px solid #0d9488; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; color: #0d9488; font-size: 14px; font-weight: 600;">
            What you'll need:
          </p>
          <ul style="margin: 0; padding-left: 20px; color: #18181b; font-size: 14px; line-height: 1.8;">
            <li>A valid government-issued ID (passport, driver's license, or national ID)</li>
            <li>Good lighting for clear photos</li>
            <li>5 minutes to complete the process</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${kycLink}" style="display: inline-block; background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Verify My Identity
          </a>
        </div>
        <p style="color: #71717a; font-size: 14px; margin: 24px 0 0 0;">
          This link is secure and will expire in 7 days. If you didn't request this verification, please contact us immediately.
        </p>
      `,
    },
    'kyc-approved': {
      subject: `✅ Identity Verified - ${config.brandName}`,
      body: `
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Dear ${firstName},
        </p>
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Great news! Your identity has been successfully verified.
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
          <p style="margin: 0; color: #16a34a; font-size: 18px; font-weight: 600;">
            ✓ KYC Verification Complete
          </p>
        </div>
        <h3 style="color: #18181b; font-size: 18px; margin: 24px 0 12px 0;">Next Step: Medical Review</h3>
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Your application is now being reviewed by our medical team. This typically takes 1-2 business days.
        </p>
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          We'll notify you by email once your medical eligibility has been confirmed.
        </p>
      `,
    },
    'kyc-rejected': {
      subject: `Identity Verification - Additional Information Required`,
      body: `
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Dear ${firstName},
        </p>
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Unfortunately, we were unable to verify your identity with the information provided.
        </p>
        <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">
            Reason:
          </p>
          <p style="margin: 0; color: #18181b; font-size: 14px;">
            ${rejectionReason || 'The document quality was insufficient or the information could not be verified.'}
          </p>
        </div>
        <h3 style="color: #18181b; font-size: 18px; margin: 24px 0 12px 0;">How to resubmit:</h3>
        <ul style="color: #18181b; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Ensure your ID is not expired</li>
          <li>Take photos in good lighting</li>
          <li>Make sure all text on the document is clearly readable</li>
          <li>Avoid glare or shadows on the document</li>
        </ul>
        ${kycLink ? `
          <div style="text-align: center; margin: 32px 0;">
            <a href="${kycLink}" style="display: inline-block; background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
              Retry Verification
            </a>
          </div>
        ` : ''}
        <p style="color: #71717a; font-size: 14px; margin: 24px 0 0 0;">
          If you need assistance, please contact our support team at ${config.supportEmail}
        </p>
      `,
    },
    'eligibility-approved': {
      subject: `🎉 You're Approved for Medical Cannabis - ${config.brandName}`,
      body: `
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Dear ${firstName},
        </p>
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Congratulations! Your application for medical cannabis has been approved by our medical team.
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="margin: 0; color: #16a34a; font-size: 20px; font-weight: 600;">
            🎉 Medical Eligibility Confirmed
          </p>
          <p style="margin: 8px 0 0 0; color: #18181b; font-size: 14px;">
            You now have full access to browse and purchase medical cannabis products.
          </p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${config.websiteUrl}/shop" style="display: inline-block; background-color: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Browse Products
          </a>
        </div>
        <h3 style="color: #18181b; font-size: 18px; margin: 24px 0 12px 0;">Important Information:</h3>
        <ul style="color: #18181b; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Always follow dosage guidelines provided with your products</li>
          <li>Keep your prescription documentation accessible</li>
          <li>Contact our support team if you have any questions</li>
        </ul>
      `,
    },
    'eligibility-rejected': {
      subject: `Medical Eligibility Review - ${config.brandName}`,
      body: `
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          Dear ${firstName},
        </p>
        <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
          After careful review, we regret to inform you that your medical cannabis application could not be approved at this time.
        </p>
        <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">
            Reason:
          </p>
          <p style="margin: 0; color: #18181b; font-size: 14px;">
            ${rejectionReason || 'Based on the medical information provided, you do not currently meet our eligibility criteria for medical cannabis.'}
          </p>
        </div>
        <h3 style="color: #18181b; font-size: 18px; margin: 24px 0 12px 0;">What you can do:</h3>
        <ul style="color: #18181b; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Consult with your healthcare provider about alternative options</li>
          <li>Request a review by contacting our medical team</li>
          <li>Reapply if your medical situation changes</li>
        </ul>
        <p style="color: #71717a; font-size: 14px; margin: 24px 0 0 0;">
          If you believe this decision was made in error or have additional medical documentation, please contact us at ${config.supportEmail}
        </p>
      `,
    },
  };

  const template = templates[type] || templates['welcome'];

  return {
    subject: template.subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${baseStyles}">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background-color: ${headerColor}; padding: 24px; text-align: center;">
            <img src="${logoUrl}" alt="${config.brandName}" width="180" style="display: inline-block; max-width: 180px; height: auto;" />
            <p style="color: #ffffff; margin: 12px 0 0 0; font-size: 14px;">Medical Cannabis Care</p>
          </div>
          <div style="padding: 32px;">
            ${template.body}
          </div>
          <div style="background-color: #f4f4f5; padding: 20px; text-align: center;">
            <p style="margin: 0; color: #71717a; font-size: 12px;">
              ${config.brandName}
            </p>
            <p style="margin: 4px 0 0 0; color: #a1a1aa; font-size: 11px;">
              ${config.address}
            </p>
            <p style="margin: 8px 0 0 0; color: #a1a1aa; font-size: 11px;">
              Need help? Contact us at <a href="mailto:${config.supportEmail}" style="color: #0d9488;">${config.supportEmail}</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ClientEmailRequest = await req.json();
    console.log('[send-client-email] Request received:', { type: request.type, email: request.email, region: request.region });

    // Validate required fields
    if (!request.email || !request.type || !request.name) {
      console.error('[send-client-email] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, type, name' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error('[send-client-email] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get domain config based on region
    const domainConfig = getDomainConfig(request.region);
    console.log('[send-client-email] Using domain config:', { domain: domainConfig.domain, brandName: domainConfig.brandName });

    // Generate email content
    const emailContent = getEmailTemplate(request, domainConfig);

    // Determine from address - use verified domain or fallback
    // Note: Until domains are verified on Resend, we use onboarding@resend.dev
    const fromAddress = `${domainConfig.brandName} <noreply@${domainConfig.sendDomain}>`;

    console.log('[send-client-email] Sending email:', {
      from: fromAddress,
      to: request.email,
      subject: emailContent.subject,
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [request.email.trim()],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[send-client-email] Resend API error:', data);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: data }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('[send-client-email] Email sent successfully:', data);

    // Log journey event if clientId is provided
    if (request.clientId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        // Get user ID from client
        const { data: clientData } = await supabase
          .from('drgreen_clients')
          .select('user_id')
          .eq('drgreen_client_id', request.clientId)
          .single();
        
        if (clientData?.user_id) {
          await supabase.from('kyc_journey_logs').insert({
            user_id: clientData.user_id,
            client_id: request.clientId,
            event_type: `email.${request.type}_sent`,
            event_source: 'send-client-email',
            event_data: {
              emailType: request.type,
              region: request.region,
              success: true,
            },
          });
          console.log(`[KYC Journey] Logged: email.${request.type}_sent`);
        }
      } catch (logError) {
        console.warn('[KYC Journey] Failed to log email event:', logError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('[send-client-email] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
