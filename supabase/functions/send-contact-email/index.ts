import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limiting storage (in-memory for edge function)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 3; // Max 3 submissions
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds

interface ContactFormRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Simple validation function (mirrors frontend Zod schema)
function validateContactForm(data: ContactFormRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Name validation
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Name is required');
  } else if (data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  } else if (data.name.trim().length > 100) {
    errors.push('Name must be less than 100 characters');
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (!emailRegex.test(data.email.trim())) {
    errors.push('Invalid email address');
  } else if (data.email.trim().length > 255) {
    errors.push('Email must be less than 255 characters');
  }
  
  // Subject validation
  if (!data.subject || typeof data.subject !== 'string') {
    errors.push('Subject is required');
  } else if (data.subject.trim().length < 3) {
    errors.push('Subject must be at least 3 characters');
  } else if (data.subject.trim().length > 200) {
    errors.push('Subject must be less than 200 characters');
  }
  
  // Message validation
  if (!data.message || typeof data.message !== 'string') {
    errors.push('Message is required');
  } else if (data.message.trim().length < 10) {
    errors.push('Message must be at least 10 characters');
  } else if (data.message.trim().length > 2000) {
    errors.push('Message must be less than 2000 characters');
  }
  
  return { valid: errors.length === 0, errors };
}

// Rate limiting check
function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    // First request or window expired - reset
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Increment count
  record.count++;
  rateLimitMap.set(identifier, record);
  return { allowed: true };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting (fallback to email)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    console.log(`[Contact Form] Request from IP: ${clientIP}`);
    
    const body = await req.json();
    const { name, email, subject, message }: ContactFormRequest = body;
    
    // Server-side validation
    const validation = validateContactForm({ name, email, subject, message });
    if (!validation.valid) {
      console.log(`[Contact Form] Validation failed:`, validation.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Validation failed', 
          details: validation.errors 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Rate limiting check (by IP and email)
    const ipRateLimit = checkRateLimit(`ip:${clientIP}`);
    const emailRateLimit = checkRateLimit(`email:${email.trim().toLowerCase()}`);
    
    if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
      const retryAfter = Math.max(ipRateLimit.retryAfter || 0, emailRateLimit.retryAfter || 0);
      console.log(`[Contact Form] Rate limited - IP: ${clientIP}, Email: ${email}, retry after: ${retryAfter}s`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many requests. Please try again later.',
          retryAfter 
        }),
        {
          status: 429,
          headers: { 
            "Content-Type": "application/json", 
            "Retry-After": String(retryAfter),
            ...corsHeaders 
          },
        }
      );
    }
    
    // Logo URL for email header
    const logoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/email-assets/hb-logo-white.png`;

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f7f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: linear-gradient(135deg, #2a3d3a 0%, #1a2e2a 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
            <img src="${logoUrl}" alt="Healing Buds" width="180" style="display: inline-block; max-width: 180px; height: auto;" />
            <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 14px;">Medical Cannabis Care</p>
          </div>
          <div style="background-color: #ffffff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <h2 style="color: #1a2e2a; margin: 0 0 16px; font-size: 20px;">Thank you for contacting us, ${name.trim()}!</h2>
            <p style="color: #5a6b68; line-height: 1.6; margin: 0 0 16px;">We have received your message and will get back to you as soon as possible.</p>
            <div style="background-color: #f4f7f6; padding: 20px; border-radius: 12px; margin: 24px 0;">
              <p style="color: #5a6b68; margin: 0 0 8px; font-size: 14px;"><strong>Subject:</strong> ${subject.trim()}</p>
              <p style="color: #5a6b68; margin: 0; font-size: 14px;"><strong>Your message:</strong></p>
              <p style="color: #5a6b68; margin: 8px 0 0; font-size: 14px; white-space: pre-wrap;">${message.trim()}</p>
            </div>
            <p style="color: #5a6b68; line-height: 1.6; margin: 24px 0 0;">
              Best regards,<br>
              <strong>The Healing Buds Team</strong>
            </p>
          </div>
          <div style="text-align: center; padding: 24px 0;">
            <p style="color: #8a9a96; font-size: 12px; margin: 0;">© 2024 Healing Buds Global. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email using Resend API via fetch
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Healing Buds <noreply@send.healingbuds.co.za>",  // Contact form is global, always use .co.za
        to: [email.trim()],
        subject: "Thank you for contacting Healing Buds",
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();
    
    if (!resendResponse.ok) {
      console.error(`[Contact Form] Resend API error:`, resendData);
      throw new Error(resendData.message || 'Failed to send email');
    }

    console.log(`[Contact Form] Email sent successfully to ${email}:`, resendData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Your message has been sent successfully. We will get back to you soon.' 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[Contact Form] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "An unexpected error occurred. Please try again later." 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
