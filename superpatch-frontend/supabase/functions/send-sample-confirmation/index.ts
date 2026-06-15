// Supabase Edge Function for sending sample request confirmation emails
// Uses Resend API to send professional confirmation emails
// @ts-nocheck - Deno types not available in IDE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { redactEmail, redactName } from "../_shared/redact.ts";
import { sanitizeError } from "../_shared/sanitize-error.ts";

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "samples@superpatch.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface SampleConfirmationRequest {
  sample_request_id: string;
  practitioner_name: string;
  practice_name?: string;
  email: string;
  phone?: string;
  products?: string[];
  shipping_address?: string;
  shipping_city?: string;
  shipping_province?: string;
  shipping_postal_code?: string;
}

/**
 * Generate HTML email content
 */
function generateEmailHtml(data: SampleConfirmationRequest): string {
  const productList = data.products && data.products.length > 0
    ? data.products.map(p => `<li>${p}</li>`).join("")
    : "<li>Standard Sample Kit</li>";

  const shippingAddress = [
    data.shipping_address,
    data.shipping_city,
    data.shipping_province,
    data.shipping_postal_code,
  ]
    .filter(Boolean)
    .join(", ") || "Address will be confirmed";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sample Request Confirmation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { margin: 0; font-size: 24px; }
    h2 { color: #667eea; font-size: 18px; margin-top: 0; }
    ul { padding-left: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    .highlight { background: #667eea; color: white; padding: 3px 8px; border-radius: 4px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Sample Request Confirmed!</h1>
    <p>Thank you for your interest in Super Patch</p>
  </div>
  
  <div class="content">
    <div class="section">
      <h2>Hello ${data.practitioner_name}!</h2>
      <p>We're excited to send you samples of our revolutionary Vibrotactile Technology patches. Your request has been received and is being processed.</p>
    </div>
    
    <div class="section">
      <h2>📦 Products Requested</h2>
      <ul>
        ${productList}
      </ul>
    </div>
    
    <div class="section">
      <h2>📍 Shipping To</h2>
      <p><strong>${data.practice_name || data.practitioner_name}</strong></p>
      <p>${shippingAddress}</p>
    </div>
    
    <div class="section">
      <h2>⏰ What's Next?</h2>
      <ol>
        <li>Our team will prepare your sample kit</li>
        <li>You'll receive tracking information once shipped</li>
        <li>Estimated delivery: 3-5 business days</li>
        <li>A specialist will follow up to answer any questions</li>
      </ol>
    </div>
    
    <div class="section">
      <h2>📞 Questions?</h2>
      <p>If you have any questions about your sample request or Super Patch products, please don't hesitate to reach out:</p>
      <p>Email: <a href="mailto:support@superpatch.com">support@superpatch.com</a></p>
      <p>Phone: 1-800-SUPERPATCH</p>
    </div>
  </div>
  
  <div class="footer">
    <p>© ${new Date().getFullYear()} Super Patch Company. All rights reserved.</p>
    <p>This email was sent because you requested product samples.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text email content
 */
function generateEmailText(data: SampleConfirmationRequest): string {
  const products = data.products && data.products.length > 0
    ? data.products.join(", ")
    : "Standard Sample Kit";

  const shippingAddress = [
    data.shipping_address,
    data.shipping_city,
    data.shipping_province,
    data.shipping_postal_code,
  ]
    .filter(Boolean)
    .join(", ") || "Address will be confirmed";

  return `
SAMPLE REQUEST CONFIRMED!

Hello ${data.practitioner_name}!

We're excited to send you samples of our revolutionary Vibrotactile Technology patches. Your request has been received and is being processed.

PRODUCTS REQUESTED:
${products}

SHIPPING TO:
${data.practice_name || data.practitioner_name}
${shippingAddress}

WHAT'S NEXT:
1. Our team will prepare your sample kit
2. You'll receive tracking information once shipped
3. Estimated delivery: 3-5 business days
4. A specialist will follow up to answer any questions

QUESTIONS?
Email: support@superpatch.com
Phone: 1-800-SUPERPATCH

Thank you for your interest in Super Patch!

---
© ${new Date().getFullYear()} Super Patch Company. All rights reserved.
  `.trim();
}

/**
 * Send email via Resend API
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ id: string }> {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Update sample request with confirmation status
 */
async function updateSampleRequest(
  supabase: ReturnType<typeof createClient>,
  sampleRequestId: string
): Promise<void> {
  const { error } = await supabase
    .from("sample_requests")
    .update({
      confirmation_sent: true,
      confirmation_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sampleRequestId);

  if (error) {
    console.error("Failed to update sample request:", error);
  }
}

// CORS and auth helpers
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function verifyServiceAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  // Verify caller is authorized (service role key)
  if (!verifyServiceAuth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  console.log("📧 send-sample-confirmation edge function called");

  try {
    const body: SampleConfirmationRequest = await req.json();

    console.log("📋 Confirmation request:", {
      sample_request_id: body.sample_request_id,
      practitioner_name: redactName(body.practitioner_name),
      email: redactEmail(body.email),
    });

    // Validate required fields
    if (!body.email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.sample_request_id) {
      return new Response(
        JSON.stringify({ error: "sample_request_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if confirmation already sent
    const { data: existingRequest } = await supabase
      .from("sample_requests")
      .select("confirmation_sent")
      .eq("id", body.sample_request_id)
      .single();

    if (existingRequest?.confirmation_sent) {
      console.log("⏭️ Confirmation already sent, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Confirmation already sent" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate email content
    const html = generateEmailHtml(body);
    const text = generateEmailText(body);
    const subject = `Sample Request Confirmed - ${body.practice_name || body.practitioner_name}`;

    // Send email
    const emailResult = await sendEmail(body.email, subject, html, text);

    // Log only the Resend message id; the rest of the result includes
    // the recipient address and other metadata we don't want to ship to
    // logs in cleartext.
    console.log(
      "✅ Email sent:",
      emailResult && typeof emailResult === "object" && "id" in emailResult
        ? { id: (emailResult as { id?: string }).id ?? "[no-id]" }
        : "[no-result-shape]",
    );

    // Update sample request
    await updateSampleRequest(supabase, body.sample_request_id);

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("❌ Email error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        ...sanitizeError(error, { code: "send_sample_confirmation_failed" }),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
