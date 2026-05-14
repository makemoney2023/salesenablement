// Supabase Edge Function for processing the retry queue
// Triggered by cron to initiate calls for practitioners due for retry
// @ts-nocheck - Deno types not available in IDE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  KB_ID,
  VOICE_ID,
  DEFAULT_WEBHOOK_URL,
  getPathwayId,
} from "../_shared/pathways.ts";
import { incrementRetry, IncrementRetryError } from "./retry.ts";
import { isWithinBusinessHours as isBizHours } from "./business-hours.ts";

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY") || "";
const BLAND_API_URL = "https://api.bland.ai/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Batch size for concurrent calls (limit to avoid rate limits)
const BATCH_SIZE = 10;

const WEBHOOK_URL = Deno.env.get("WEBHOOK_URL") || DEFAULT_WEBHOOK_URL;
// Bland Memory Store ID for cross-call context retention
const MEMORY_ID = Deno.env.get("BLAND_MEMORY_ID") || "";

// Business hours configuration
const BUSINESS_TIMEZONE = Deno.env.get("BUSINESS_TIMEZONE") || "America/Toronto";
const BUSINESS_HOURS = { start: 9, end: 17 }; // 9 AM - 5 PM

/**
 * Check if current time is within business hours in the configured timezone.
 * Delegated to the pure ./business-hours.ts module which is fail-closed —
 * timezone / formatter errors return false, never true. Previously the
 * inline implementation defaulted to `true` ("allow calls") on failure,
 * which during a DST transition could let after-hours dials slip through.
 */
function isWithinBusinessHours(): boolean {
  return isBizHours(BUSINESS_TIMEZONE, new Date(), BUSINESS_HOURS);
}

interface RetryQueueEntry {
  id: string;
  name: string;
  phone: string;
  practitioner_type: string | null;
  retry_count: number;
  next_retry_at: string;
  retry_reason: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  website: string | null;
}

interface CallResult {
  practitioner_id: string;
  success: boolean;
  call_id?: string;
  error?: string;
}

/**
 * Custom error so the caller can distinguish "queue is healthy but empty"
 * from "DB query failed and we have NO IDEA whether the queue is empty".
 * The previous implementation returned `[]` on DB error, which made the cron
 * job log a successful "0 retries processed" tick when the queue was actually
 * broken — exactly the class of silent failure this audit is hunting.
 */
class RetryQueueFetchError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "RetryQueueFetchError";
  }
}

// Get practitioners due for retry. Throws RetryQueueFetchError on DB failure.
async function getRetryQueue(supabase: ReturnType<typeof createClient>, limit: number = 50): Promise<RetryQueueEntry[]> {
  const { data, error } = await supabase
    .from("practitioners")
    .select("id, name, phone, practitioner_type, retry_count, next_retry_at, retry_reason, city, province, address, rating, review_count, website")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .eq("do_not_call", false)
    .not("phone", "is", null)
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new RetryQueueFetchError(
      `Failed to fetch retry queue: ${error.message ?? "unknown error"}`,
      error,
    );
  }

  return (data || []) as RetryQueueEntry[];
}

// Initiate a call via Bland.ai
async function initiateCall(practitioner: RetryQueueEntry): Promise<CallResult> {
  if (!BLAND_API_KEY) {
    return {
      practitioner_id: practitioner.id,
      success: false,
      error: "BLAND_API_KEY not configured",
    };
  }

  // Determine pathway based on practitioner type (auto-selected, no env vars needed)
  const pathwayId = getPathwayId(practitioner.practitioner_type);

  console.log(`[RetryQueue] Using pathway ${pathwayId} for ${practitioner.practitioner_type || 'unknown type'}`);

  // Build call payload (same structure as batch-caller.ts)
  const callPayload: Record<string, unknown> = {
    phone_number: practitioner.phone,
    pathway_id: pathwayId,
    // Don't specify pathway_version - uses production version by default
    knowledge_base: KB_ID,
    voice: VOICE_ID,
    wait_for_greeting: true,
    record: true,
    max_duration: 15, // 15 minutes max (same as batch-caller)
    webhook: WEBHOOK_URL,
    request_data: {
      practice_name: practitioner.name || "your practice",
      practice_address: practitioner.address || "",
      practice_city: practitioner.city || "",
      practice_province: practitioner.province || "",
      google_rating: practitioner.rating?.toString() || "",
      review_count: practitioner.review_count?.toString() || "",
      website: practitioner.website || "",
      practitioner_type: practitioner.practitioner_type || "",
      has_address: practitioner.address ? "true" : "false",
      // For greeting personalization in pathway
      greeting_name: practitioner.name || "there",
    },
    metadata: {
      campaign: "canadian_practitioners",
      source: "retry_queue",
      practitioner_id: practitioner.id,
      practice_name: practitioner.name,
      practitioner_type: practitioner.practitioner_type,
      address: practitioner.address,
      city: practitioner.city,
      province: practitioner.province,
      retry_count: practitioner.retry_count,
      retry_reason: practitioner.retry_reason,
    },
  };

  // Add memory_id for cross-call context retention (if configured)
  if (MEMORY_ID) {
    callPayload.memory_id = MEMORY_ID.trim();
  }

  try {
    console.log(`[RetryQueue] Initiating call to ${practitioner.name} (${practitioner.phone})`);
    console.log(`   Retry #${practitioner.retry_count}, Reason: ${practitioner.retry_reason}`);

    const response = await fetchWithTimeout(`${BLAND_API_URL}/calls`, {
      method: "POST",
      headers: {
        "Authorization": BLAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[RetryQueue] Call failed for ${practitioner.name}:`, data);
      return {
        practitioner_id: practitioner.id,
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    console.log(`[RetryQueue] ✅ Call initiated for ${practitioner.name}, call_id: ${data.call_id}`);
    return {
      practitioner_id: practitioner.id,
      success: true,
      call_id: data.call_id,
    };
  } catch (error) {
    console.error(`[RetryQueue] Error initiating call for ${practitioner.name}:`, error);
    return {
      practitioner_id: practitioner.id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Update practitioner after call attempt. The Bland call_id used to be
// passed in and ignored — removed (callers no longer pass it either).
async function updatePractitionerAfterCall(
  supabase: ReturnType<typeof createClient>,
  practitionerId: string,
  success: boolean,
): Promise<void> {
  if (success) {
    // Clear next_retry_at since call was initiated
    // The webhook handler will schedule next retry if needed
    await supabase
      .from("practitioners")
      .update({
        next_retry_at: null,
        last_call_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", practitionerId);
  } else {
    // On failure, use atomic increment to prevent race conditions
    const maxAttempts = 3;
    let newRetryCount: number;

    try {
      newRetryCount = await incrementRetry(supabase, practitionerId);
    } catch (err) {
      // Fallback to non-atomic read/write only if the atomic RPC is unavailable.
      // (Previously this branch ran on every call because the RPC was being
      // invoked with the wrong argument name; see retry.ts.)
      const cause = err instanceof IncrementRetryError ? err.cause : err;
      console.warn("[RetryQueue] Atomic increment RPC failed, using fallback:", cause);
      const { data: current } = await supabase
        .from("practitioners")
        .select("retry_count")
        .eq("id", practitionerId)
        .single();
      newRetryCount = ((current as { retry_count: number } | null)?.retry_count || 0) + 1;
    }

    if (newRetryCount >= maxAttempts) {
      // Max retries reached, mark for manual review
      await supabase
        .from("practitioners")
        .update({
          next_retry_at: null,
          retry_reason: "max_retries_reached",
          updated_at: new Date().toISOString(),
        })
        .eq("id", practitionerId);
    } else {
      // Schedule another retry in 4 hours
      const nextRetry = new Date(Date.now() + 4 * 60 * 60 * 1000);
      await supabase
        .from("practitioners")
        .update({
          retry_count: newRetryCount,
          next_retry_at: nextRetry.toISOString(),
          retry_reason: "call_initiation_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", practitionerId);
    }
  }
}

// Process the retry queue
async function processRetryQueue(supabase: ReturnType<typeof createClient>): Promise<{
  processed: number;
  successful: number;
  failed: number;
  skipped_reason?: string;
  results: CallResult[];
}> {
  // Check business hours before initiating any calls
  if (!isWithinBusinessHours()) {
    console.log("[RetryQueue] Outside business hours — skipping retry processing");
    return { processed: 0, successful: 0, failed: 0, skipped_reason: "outside_business_hours", results: [] };
  }

  // Get practitioners due for retry. getRetryQueue now THROWS
  // RetryQueueFetchError on DB failure so we can return a distinct error
  // skipped_reason instead of silently logging "0 retries processed".
  let queue: RetryQueueEntry[];
  try {
    queue = await getRetryQueue(supabase, 50);
  } catch (err) {
    const detail = err instanceof RetryQueueFetchError ? err.message : String(err);
    console.error("[RetryQueue] getRetryQueue failed:", detail);
    return {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped_reason: `queue_fetch_failed: ${detail}`,
      results: [],
    };
  }

  if (queue.length === 0) {
    console.log("[RetryQueue] No practitioners due for retry");
    return { processed: 0, successful: 0, failed: 0, results: [] };
  }

  console.log(`[RetryQueue] Processing ${queue.length} practitioners`);

  const results: CallResult[] = [];
  let successful = 0;
  let failed = 0;

  // Process in batches to avoid rate limits
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    console.log(`[RetryQueue] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} practitioners)`);

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (practitioner) => {
        const result = await initiateCall(practitioner);
        await updatePractitionerAfterCall(supabase, practitioner.id, result.success);
        return result;
      })
    );

    results.push(...batchResults);
    successful += batchResults.filter((r) => r.success).length;
    failed += batchResults.filter((r) => !r.success).length;

    // Small delay between batches to be nice to Bland.ai
    if (i + BATCH_SIZE < queue.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return {
    processed: queue.length,
    successful,
    failed,
    results,
  };
}

// Main handler
// CORS and auth helpers
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
if (ALLOWED_ORIGIN === "*") {
  console.warn("⚠️ ALLOWED_ORIGIN not set - using wildcard CORS. Set ALLOWED_ORIGIN in production!");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function verifyServiceAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Verify caller is authorized (service role key)
  if (!verifyServiceAuth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify configuration
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Supabase not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!BLAND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "BLAND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Check if this is a manual trigger with specific IDs
    let body: { practitionerIds?: string[] } = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        // No body or invalid JSON - proceed with queue processing
      }
    }

    if (body.practitionerIds && body.practitionerIds.length > 0) {
      // Manual trigger for specific practitioners
      console.log(`[RetryQueue] Manual trigger for ${body.practitionerIds.length} practitioners`);

      const { data: practitioners, error } = await supabase
        .from("practitioners")
        .select("id, name, phone, practitioner_type, retry_count, next_retry_at, retry_reason, city, province")
        .in("id", body.practitionerIds)
        .eq("do_not_call", false)
        .not("phone", "is", null);

      if (error || !practitioners || practitioners.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid practitioners found", details: error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: CallResult[] = [];
      for (const practitioner of practitioners as RetryQueueEntry[]) {
        const result = await initiateCall(practitioner);
        await updatePractitionerAfterCall(supabase, practitioner.id, result.success);
        results.push(result);
      }

      return new Response(
        JSON.stringify({
          message: "Manual retry calls initiated",
          processed: results.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          results,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normal queue processing
    const result = await processRetryQueue(supabase);

    return new Response(
      JSON.stringify({
        message: "Retry queue processed",
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RetryQueue] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
