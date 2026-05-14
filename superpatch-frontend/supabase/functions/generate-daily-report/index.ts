// Supabase Edge Function for generating daily campaign reports
// Triggered by pg_cron at 8:00 AM UTC to generate yesterday's report
// @ts-nocheck - Deno types not available in IDE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface DailyReportData {
  date: string;
  total_calls: number;
  calls_answered: number;
  calls_voicemail: number;
  calls_no_answer: number;
  completed: number;
  booked: number;
  failed: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  demos_booked: number;
  samples_requested: number;
  high_interest: number;
  medium_interest: number;
  low_interest: number;
  answer_rate: number;
  conversion_rate: number;
  retries_scheduled: number;
  retries_completed: number;
  new_practitioners: number;
  enriched_practitioners: number;
}

/**
 * Get the date range for the report (default: yesterday)
 */
function getReportDateRange(targetDate?: string): { start: string; end: string; date: string } {
  let reportDate: Date;
  
  if (targetDate) {
    reportDate = new Date(targetDate);
  } else {
    // Default to yesterday
    reportDate = new Date();
    reportDate.setDate(reportDate.getDate() - 1);
  }
  
  // Set to start of day
  const start = new Date(reportDate);
  start.setUTCHours(0, 0, 0, 0);
  
  // Set to end of day
  const end = new Date(reportDate);
  end.setUTCHours(23, 59, 59, 999);
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    date: reportDate.toISOString().split("T")[0],
  };
}

/**
 * Generate the daily report
 */
async function generateReport(
  supabase: ReturnType<typeof createClient>,
  dateRange: { start: string; end: string; date: string }
): Promise<DailyReportData> {
  console.log(`📊 Generating report for ${dateRange.date}`);
  
  // Query call records for the day
  const { data: callRecords, error: callError } = await supabase
    .from("call_records")
    .select("*")
    .gte("created_at", dateRange.start)
    .lte("created_at", dateRange.end);
  
  if (callError) {
    console.error("Error fetching call records:", callError);
    throw new Error(`Failed to fetch call records: ${callError.message}`);
  }
  
  const records = callRecords || [];
  
  // Calculate call metrics
  const totalCalls = records.length;
  const callsAnswered = records.filter(r => 
    r.status === "completed" || r.status === "interested" || r.status === "demo_booked"
  ).length;
  const callsVoicemail = records.filter(r => r.status === "voicemail").length;
  const callsNoAnswer = records.filter(r => r.status === "no_answer").length;
  const completed = records.filter(r => r.status === "completed").length;
  const booked = records.filter(r => r.appointment_booked === true).length;
  const failed = records.filter(r => r.status === "failed").length;
  
  // Calculate duration
  const totalDuration = records.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
  const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
  
  // Calculate conversions
  const demosBooked = records.filter(r => r.appointment_booked === true).length;
  
  // Query sample requests for the day. Fail loudly on DB error rather than
  // silently saving a report with `samples_requested: 0` — the previous
  // behavior produced misleading "all zeros" reports during outages.
  const { data: sampleRequests, error: sampleError } = await supabase
    .from("sample_requests")
    .select("*")
    .gte("created_at", dateRange.start)
    .lte("created_at", dateRange.end);

  if (sampleError) {
    throw new Error(
      `[generate-daily-report] sample_requests query failed: ${sampleError.message ?? "unknown"}`,
    );
  }

  const samplesRequested = (sampleRequests || []).length;

  // Calculate interest levels from practitioners table. Same fail-loud policy.
  const { data: practitioners, error: practError } = await supabase
    .from("practitioners")
    .select("interest_level")
    .gte("last_call_at", dateRange.start)
    .lte("last_call_at", dateRange.end);

  if (practError) {
    throw new Error(
      `[generate-daily-report] practitioners query failed: ${practError.message ?? "unknown"}`,
    );
  }
  
  const practitionerData = practitioners || [];
  const highInterest = practitionerData.filter(p => p.interest_level === "high").length;
  const mediumInterest = practitionerData.filter(p => p.interest_level === "medium").length;
  const lowInterest = practitionerData.filter(p => p.interest_level === "low").length;
  
  // Calculate rates
  const answerRate = totalCalls > 0 ? Math.round((callsAnswered / totalCalls) * 100) / 100 : 0;
  const conversionRate = callsAnswered > 0 
    ? Math.round(((demosBooked + samplesRequested) / callsAnswered) * 100) / 100 
    : 0;
  
  // Query retry data
  const retriesResult = await supabase
    .from("practitioners")
    .select("id", { count: "exact", head: true })
    .gte("next_retry_at", dateRange.start)
    .lte("next_retry_at", dateRange.end);
  if (retriesResult.error) {
    throw new Error(
      `[generate-daily-report] retries_scheduled count failed: ${retriesResult.error.message ?? "unknown"}`,
    );
  }
  const retriesScheduled = retriesResult.data;

  // Query new practitioners added
  const newPractitionersResult = await supabase
    .from("practitioners")
    .select("*", { count: "exact", head: true })
    .gte("created_at", dateRange.start)
    .lte("created_at", dateRange.end);
  if (newPractitionersResult.error) {
    throw new Error(
      `[generate-daily-report] new_practitioners count failed: ${newPractitionersResult.error.message ?? "unknown"}`,
    );
  }
  const newPractitioners = newPractitionersResult.count;

  // Query enriched practitioners
  const enrichedResult = await supabase
    .from("practitioners")
    .select("*", { count: "exact", head: true })
    .eq("enrichment_status", "enriched")
    .gte("enriched_at", dateRange.start)
    .lte("enriched_at", dateRange.end);
  if (enrichedResult.error) {
    throw new Error(
      `[generate-daily-report] enriched_practitioners count failed: ${enrichedResult.error.message ?? "unknown"}`,
    );
  }
  const enrichedPractitioners = enrichedResult.count;
  
  return {
    date: dateRange.date,
    total_calls: totalCalls,
    calls_answered: callsAnswered,
    calls_voicemail: callsVoicemail,
    calls_no_answer: callsNoAnswer,
    completed,
    booked,
    failed,
    total_duration_seconds: totalDuration,
    avg_duration_seconds: avgDuration,
    demos_booked: demosBooked,
    samples_requested: samplesRequested,
    high_interest: highInterest,
    medium_interest: mediumInterest,
    low_interest: lowInterest,
    answer_rate: answerRate,
    conversion_rate: conversionRate,
    retries_scheduled: 0, // Will be calculated from logs
    retries_completed: 0, // Will be calculated from logs
    new_practitioners: newPractitioners || 0,
    enriched_practitioners: enrichedPractitioners || 0,
  };
}

/**
 * Save the report to campaign_analytics table
 */
async function saveReport(
  supabase: ReturnType<typeof createClient>,
  report: DailyReportData
): Promise<void> {
  // Upsert to handle re-runs for the same date
  const { error } = await supabase
    .from("campaign_analytics")
    .upsert(
      {
        date: report.date,
        total_calls: report.total_calls,
        completed: report.completed,
        booked: report.booked,
        failed: report.failed,
        total_duration_seconds: report.total_duration_seconds,
        calls_answered: report.calls_answered,
        calls_voicemail: report.calls_voicemail,
        calls_no_answer: report.calls_no_answer,
        avg_duration_seconds: report.avg_duration_seconds,
        demos_booked: report.demos_booked,
        samples_requested: report.samples_requested,
        high_interest: report.high_interest,
        medium_interest: report.medium_interest,
        low_interest: report.low_interest,
        answer_rate: report.answer_rate,
        conversion_rate: report.conversion_rate,
        retries_scheduled: report.retries_scheduled,
        retries_completed: report.retries_completed,
        new_practitioners: report.new_practitioners,
        enriched_practitioners: report.enriched_practitioners,
      },
      { onConflict: "date" }
    );
  
  if (error) {
    throw new Error(`Failed to save report: ${error.message}`);
  }
}

// CORS and auth helpers
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

  console.log("📊 generate-daily-report edge function called");

  try {
    // Parse optional date from request
    let targetDate: string | undefined;
    
    if (req.method === "POST") {
      try {
        const body = await req.json();
        targetDate = body.date;
      } catch {
        // No body or invalid JSON, use default (yesterday)
      }
    }
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get date range
    const dateRange = getReportDateRange(targetDate);
    
    console.log(`📅 Report date range: ${dateRange.start} to ${dateRange.end}`);
    
    // Check if report already exists
    const { data: existingReport } = await supabase
      .from("campaign_analytics")
      .select("*")
      .eq("date", dateRange.date)
      .single();
    
    if (existingReport && !targetDate) {
      console.log("⏭️ Report already exists for this date, updating...");
    }
    
    // Generate report
    const report = await generateReport(supabase, dateRange);
    
    console.log("📈 Report generated:", report);
    
    // Save report
    await saveReport(supabase, report);
    
    console.log("✅ Report saved successfully");
    
    return new Response(
      JSON.stringify({
        success: true,
        report,
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
    console.error("❌ Report generation error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
