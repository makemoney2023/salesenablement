// Supabase Edge Function for processing Bland.ai webhooks
// Migrated from Next.js /api/webhooks/bland/route.ts
// @ts-nocheck - Deno types not available in IDE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "@google/generative-ai";

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CAL_API_KEY = Deno.env.get("CAL_API_KEY") || "";
const CAL_EVENT_TYPE_ID = Number(Deno.env.get("CAL_EVENT_TYPE_ID")) || 4352394;
const BLAND_WEBHOOK_SECRET = Deno.env.get("BLAND_WEBHOOK_SECRET") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

// Types
type CallStatus = "not_called" | "in_progress" | "completed" | "failed" | "voicemail" | "interested" | "not_interested" | "booked" | "calendar_sent" | "demo_booked";
type RetryReason = "voicemail_left" | "no_answer" | "call_failed" | "busy" | "follow_up_requested";
type InterestLevel = "high" | "medium" | "low" | "not_interested";
type ContactRole = "owner" | "office_manager" | "receptionist" | "practitioner" | "other";
type FollowUpAction = "send_info" | "callback" | "sample" | "demo" | "none";

interface RetryPolicy {
  maxAttempts: number;
  retryDelays: number[];
  voicemailAction: "retry" | "skip" | "sms_followup";
  failedAction: "retry" | "retry_next_business_day" | "manual_review";
  businessHoursOnly: boolean;
  businessHours: { start: number; end: number; timezone: string };
}

interface PractitionerQualification {
  contact_name?: string;
  contact_role?: ContactRole;
  contact_email?: string;
  decision_maker?: boolean;
  best_callback_time?: string;
  interest_level?: InterestLevel;
  pain_points?: string;
  current_solutions?: string;
  objections?: string;
  practice_size?: number;
  patient_volume?: string;
  follow_up_action?: FollowUpAction;
  follow_up_date?: string;
  decision_timeline?: string;
  products_interested?: string;
  wants_sample?: boolean;
  wants_demo?: boolean;
}

interface PractitionerLookup {
  id: string;
  name: string;
  practitioner_type: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  enrichment?: {
    success?: boolean;
    data?: { emails?: string[] };
  } | null;
}

interface BlandWebhookPayload {
  call_id: string;
  status: string;
  to: string;
  from: string;
  call_length: number;
  completed: boolean;
  created_at: string;
  ended_at: string;
  concatenated_transcript: string;
  recording_url?: string;
  variables?: Record<string, string>;
  pathway_logs?: Record<string, unknown>[];
  analysis?: {
    summary?: string;
    sentiment?: string;
    sentiment_score?: number;
    keywords?: string[];
    [key: string]: unknown;
  };
  metadata?: {
    practitioner_id?: string;
    practice_name?: string;
    contact_name?: string;
    practitioner_type?: string;
    campaign?: string;
    source?: string;
    address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    clinic_email?: string;
    call_language?: string;
    selected_pathway?: string;
  };
  voicemail_detected?: boolean;
  answered_by?: "human" | "voicemail" | "unknown";
}

// Smart Retry Policy Configuration
const RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  retryDelays: [60, 240, 1440],
  voicemailAction: "retry",
  failedAction: "retry_next_business_day",
  businessHoursOnly: true,
  businessHours: { start: 9, end: 17, timezone: Deno.env.get("BUSINESS_TIMEZONE") || "America/Toronto" },
};

// DNC phrases to detect
const DNC_PHRASES = [
  "don't call", "do not call", "stop calling", "remove me", "take me off",
  "not interested", "never call again", "unsubscribe", "remove my number",
  "don't contact", "do not contact", "no more calls", "quit calling",
];

// Helper functions
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Handle North American numbers with country code
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  // Standard 10-digit number
  if (digits.length === 10) return digits;
  // Fallback for other formats
  return digits.slice(-10);
}

function getPractitionerEmail(
  practitioner: PractitionerLookup | null,
  varsEmail?: string,
  metaEmail?: string
): string | undefined {
  if (varsEmail) return varsEmail;
  if (metaEmail) return metaEmail;
  if (practitioner?.contact_email) return practitioner.contact_email;
  const enrichmentEmails = practitioner?.enrichment?.data?.emails;
  if (enrichmentEmails && enrichmentEmails.length > 0) return enrichmentEmails[0];
  return undefined;
}

async function findPractitionerByPhone(
  supabase: ReturnType<typeof createClient>,
  phone: string
): Promise<PractitionerLookup | null> {
  try {
    const normalizedPhone = normalizePhone(phone);
    
    const { data: exactMatch, error: exactError } = await supabase
      .from("practitioners")
      .select("id, name, practitioner_type, address, city, province, phone, contact_email, enrichment")
      .eq("phone", phone)
      .limit(1)
      .single();
    
    if (!exactError && exactMatch) {
      console.log(`📍 Found practitioner by exact phone: ${exactMatch.name}`);
      return exactMatch as PractitionerLookup;
    }
    
    const { data: partialMatches } = await supabase
      .from("practitioners")
      .select("id, name, practitioner_type, address, city, province, phone, contact_email, enrichment")
      .not("phone", "is", null)
      .limit(100);
    
    if (partialMatches) {
      for (const p of partialMatches as PractitionerLookup[]) {
        if (p.phone && normalizePhone(p.phone) === normalizedPhone) {
          console.log(`📍 Found practitioner by normalized phone: ${p.name}`);
          return p;
        }
      }
    }
    
    console.log(`📍 No practitioner found for phone: ${phone}`);
    return null;
  } catch (error) {
    console.error("Error looking up practitioner by phone:", error);
    return null;
  }
}

function calculateLeadScore(
  payload: BlandWebhookPayload,
  callStatus: string,
  qualification?: Partial<PractitionerQualification>
): number {
  let score = 0;
  
  if (payload.answered_by === "human") score += 30;
  if (payload.call_length > 120) score += 20;
  if (callStatus === "booked" || callStatus === "calendar_sent") score += 50;
  
  const vars = payload.variables || {};
  // Handle both string and boolean values from Bland
  if (String(vars.wants_sample || "").toLowerCase() === "true" || vars.wants_sample === true ||
      String(vars.sample_requested || "").toLowerCase() === "true" || vars.sample_requested === true) {
    score += 25;
  }
  
  const sentiment = payload.analysis?.sentiment?.toLowerCase();
  if (sentiment === "positive") score += 15;
  else if (sentiment === "negative") score -= 10;
  
  if (payload.voicemail_detected || payload.answered_by === "voicemail") score -= 20;
  if (!payload.completed || payload.status === "failed") score -= 30;
  
  if (qualification?.interest_level) {
    switch (qualification.interest_level) {
      case "high": score += 30; break;
      case "medium": score += 15; break;
      case "low": score += 5; break;
      case "not_interested": score -= 20; break;
    }
  }
  
  if (qualification?.decision_maker === true) score += 20;
  if (qualification?.contact_email) score += 10;
  
  if (qualification?.follow_up_action) {
    switch (qualification.follow_up_action) {
      case "demo": score += 25; break;
      case "sample": score += 20; break;
      case "callback": score += 15; break;
      case "send_info": score += 10; break;
      case "none": score -= 5; break;
    }
  }
  
  if (qualification?.practice_size) {
    if (qualification.practice_size >= 5) score += 15;
    else if (qualification.practice_size >= 3) score += 10;
    else if (qualification.practice_size >= 2) score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

function detectDNCRequest(transcript: string): { detected: boolean; matchedPhrase: string | null } {
  if (!transcript) return { detected: false, matchedPhrase: null };
  const lowerTranscript = transcript.toLowerCase();
  for (const phrase of DNC_PHRASES) {
    if (lowerTranscript.includes(phrase)) {
      console.log(`🚫 DNC phrase detected: "${phrase}"`);
      return { detected: true, matchedPhrase: phrase };
    }
  }
  return { detected: false, matchedPhrase: null };
}

async function markPractitionerAsDNC(
  supabase: ReturnType<typeof createClient>,
  practitionerId: string,
  reason: string,
  source: "ai_detected" | "manual" = "ai_detected"
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("practitioners")
      .update({
        do_not_call: true,
        dnc_reason: reason,
        dnc_detected_at: new Date().toISOString(),
        dnc_source: source,
      })
      .eq("id", practitionerId);
    
    if (error) {
      console.error("Error marking practitioner as DNC:", error);
      return false;
    }
    console.log(`✅ Practitioner ${practitionerId} marked as DNC (source: ${source})`);
    return true;
  } catch (error) {
    console.error("Error marking practitioner as DNC:", error);
    return false;
  }
}

function calculateNextRetryTime(
  delayMinutes: number,
  businessHoursOnly: boolean,
  businessHours: { start: number; end: number; timezone: string }
): Date {
  const now = new Date();
  let nextRetry = new Date(now.getTime() + delayMinutes * 60 * 1000);
  
  if (!businessHoursOnly) return nextRetry;
  
  // Use Intl.DateTimeFormat for timezone-aware calculations (handles DST correctly)
  const getLocalHour = (date: Date, timezone: string): number => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(date), 10);
  };

  const getLocalDay = (date: Date, timezone: string): number => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return dayMap[formatter.format(date)] ?? date.getDay();
  };
  
  const isBusinessHoursCheck = (date: Date): boolean => {
    const hour = getLocalHour(date, businessHours.timezone);
    const day = getLocalDay(date, businessHours.timezone);
    if (day === 0 || day === 6) return false; // Weekend
    return hour >= businessHours.start && hour < businessHours.end;
  };
  
  let maxIterations = 7 * 24;
  while (!isBusinessHoursCheck(nextRetry) && maxIterations > 0) {
    nextRetry = new Date(nextRetry.getTime() + 60 * 60 * 1000);
    maxIterations--;
  }
  
  return nextRetry;
}

async function scheduleRetry(
  supabase: ReturnType<typeof createClient>,
  practitionerId: string,
  callStatus: CallStatus,
  currentRetryCount: number
): Promise<{ scheduled: boolean; nextRetryAt: string | null; reason: string }> {
  let retryReason: RetryReason;
  let shouldRetry = false;
  let delayMinutes: number;
  
  if (callStatus === "voicemail") {
    if (RETRY_POLICY.voicemailAction === "retry") {
      shouldRetry = currentRetryCount < RETRY_POLICY.maxAttempts;
      retryReason = "voicemail_left";
      delayMinutes = RETRY_POLICY.retryDelays[currentRetryCount] || RETRY_POLICY.retryDelays[RETRY_POLICY.retryDelays.length - 1];
    } else {
      return { scheduled: false, nextRetryAt: null, reason: "Voicemail policy is skip/sms_followup" };
    }
  } else if (callStatus === "failed") {
    if (RETRY_POLICY.failedAction === "retry" || RETRY_POLICY.failedAction === "retry_next_business_day") {
      shouldRetry = currentRetryCount < RETRY_POLICY.maxAttempts;
      retryReason = "call_failed";
      delayMinutes = RETRY_POLICY.failedAction === "retry_next_business_day" ? 1440 : RETRY_POLICY.retryDelays[currentRetryCount] || 1440;
    } else {
      return { scheduled: false, nextRetryAt: null, reason: "Failed policy is manual_review" };
    }
  } else {
    return { scheduled: false, nextRetryAt: null, reason: "Status does not require retry" };
  }
  
  if (!shouldRetry) {
    return { scheduled: false, nextRetryAt: null, reason: `Max retry attempts (${RETRY_POLICY.maxAttempts}) reached` };
  }
  
  const nextRetryTime = calculateNextRetryTime(delayMinutes, RETRY_POLICY.businessHoursOnly, RETRY_POLICY.businessHours);
  
  try {
    const { error } = await supabase
      .from("practitioners")
      .update({
        retry_count: currentRetryCount + 1,
        next_retry_at: nextRetryTime.toISOString(),
        retry_reason: retryReason,
        last_call_status: callStatus,
        last_call_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", practitionerId);
    
    if (error) {
      console.error("Error scheduling retry:", error);
      return { scheduled: false, nextRetryAt: null, reason: `Database error: ${error.message}` };
    }
    
    console.log(`🔄 Retry scheduled for practitioner ${practitionerId}: ${nextRetryTime.toISOString()}`);
    return { scheduled: true, nextRetryAt: nextRetryTime.toISOString(), reason: `Retry ${currentRetryCount + 1} scheduled` };
  } catch (error) {
    console.error("Error scheduling retry:", error);
    return { scheduled: false, nextRetryAt: null, reason: `Error: ${String(error)}` };
  }
}

async function clearRetryScheduling(
  supabase: ReturnType<typeof createClient>,
  practitionerId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("practitioners")
      .update({
        next_retry_at: null,
        retry_reason: null,
        last_call_status: "completed",
        last_call_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", practitionerId);
    
    if (error) {
      console.error("Error clearing retry scheduling:", error);
      return false;
    }
    console.log(`✅ Retry scheduling cleared for practitioner ${practitionerId}`);
    return true;
  } catch (error) {
    console.error("Error clearing retry scheduling:", error);
    return false;
  }
}

function extractQualificationData(
  vars: Record<string, string>,
  meta: Record<string, string | undefined>
): Partial<PractitionerQualification> {
  const qualification: Partial<PractitionerQualification> = {};
  
  const contactName = vars.contact_name || vars.spoke_with || meta.contact_name;
  if (contactName) qualification.contact_name = contactName;
  
  const contactRole = (vars.contact_role || vars.role || vars.position)?.toLowerCase();
  if (contactRole) {
    const validRoles: ContactRole[] = ["owner", "office_manager", "receptionist", "practitioner", "other"];
    qualification.contact_role = validRoles.includes(contactRole as ContactRole) ? (contactRole as ContactRole) : "other";
  }
  
  const contactEmail = vars.email || vars.contact_email || vars.practitioner_email || meta.clinic_email;
  if (contactEmail) qualification.contact_email = contactEmail;
  
  const decisionMaker = vars.decision_maker || vars.is_decision_maker;
  if (decisionMaker !== undefined && decisionMaker !== null) {
    // Handle both string and boolean values from Bland
    qualification.decision_maker = decisionMaker === true || 
      String(decisionMaker).toLowerCase() === "yes" || 
      String(decisionMaker).toLowerCase() === "true";
  }
  
  const bestCallbackTime = vars.best_callback_time || vars.callback_time || vars.preferred_time_to_call;
  if (bestCallbackTime) qualification.best_callback_time = bestCallbackTime;
  
  const interestLevel = (vars.interest_level || vars.interest)?.toLowerCase();
  if (interestLevel) {
    const validLevels: InterestLevel[] = ["high", "medium", "low", "not_interested"];
    qualification.interest_level = validLevels.includes(interestLevel as InterestLevel) ? (interestLevel as InterestLevel) : undefined;
  }
  
  const painPoints = vars.pain_points || vars.challenges || vars.problems_mentioned;
  if (painPoints) qualification.pain_points = painPoints;
  
  const currentSolutions = vars.current_solutions || vars.current_products || vars.what_they_use;
  if (currentSolutions) qualification.current_solutions = currentSolutions;
  
  const objections = vars.objections || vars.concerns || vars.hesitations;
  if (objections) qualification.objections = objections;
  
  const practiceSize = vars.practice_size || vars.num_practitioners || vars.staff_size;
  if (practiceSize) {
    const size = parseInt(practiceSize, 10);
    if (!isNaN(size)) qualification.practice_size = size;
  }
  
  const patientVolume = vars.patient_volume || vars.patients_per_week || vars.weekly_patients;
  if (patientVolume) qualification.patient_volume = patientVolume;
  
  const followUpAction = (vars.follow_up_action || vars.next_step || vars.agreed_action)?.toLowerCase();
  if (followUpAction) {
    const validActions: FollowUpAction[] = ["send_info", "callback", "sample", "demo", "none"];
    const actionMap: Record<string, FollowUpAction> = {
      send_info: "send_info", send_information: "send_info", email_info: "send_info",
      callback: "callback", call_back: "callback", follow_up_call: "callback",
      sample: "sample", send_sample: "sample",
      demo: "demo", schedule_demo: "demo", book_demo: "demo",
      none: "none", no_action: "none",
    };
    qualification.follow_up_action = actionMap[followUpAction] || (validActions.includes(followUpAction as FollowUpAction) ? (followUpAction as FollowUpAction) : undefined);
  }
  
  const followUpDate = vars.follow_up_date || vars.callback_date || vars.next_call_date || vars.appointment_time;
  if (followUpDate) {
    try {
      const date = new Date(followUpDate);
      if (!isNaN(date.getTime())) qualification.follow_up_date = date.toISOString();
    } catch {
      qualification.follow_up_date = followUpDate;
    }
  }
  
  const decisionTimeline = vars.decision_timeline || vars.when_deciding || vars.timeline;
  if (decisionTimeline) qualification.decision_timeline = decisionTimeline;
  
  const productsInterested = vars.products_interested || vars.sample_products || vars.products_requested || vars.products;
  if (productsInterested) qualification.products_interested = productsInterested;
  
  const wantsSample = vars.wants_sample || (productsInterested ? "true" : undefined);
  if (wantsSample !== undefined && wantsSample !== null) {
    // Handle both string and boolean values from Bland
    const sampleValue = String(wantsSample).toLowerCase();
    qualification.wants_sample = sampleValue === "true" || sampleValue === "yes";
  }
  
  const wantsDemo = vars.wants_demo;
  if (wantsDemo !== undefined && wantsDemo !== null) {
    // Handle both string and boolean values from Bland
    const demoValue = String(wantsDemo).toLowerCase();
    qualification.wants_demo = demoValue === "true" || demoValue === "yes";
  }
  
  return qualification;
}

async function updatePractitionerQualification(
  supabase: ReturnType<typeof createClient>,
  practitionerId: string,
  qualification: Partial<PractitionerQualification>
): Promise<boolean> {
  const fieldsToUpdate = Object.entries(qualification).filter(([, v]) => v !== undefined && v !== null);
  if (fieldsToUpdate.length === 0) return true;
  
  try {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [key, value] of fieldsToUpdate) {
      updateData[key] = value;
    }
    
    const { error } = await supabase.from("practitioners").update(updateData).eq("id", practitionerId);
    if (error) {
      console.error("Error updating practitioner qualification:", error);
      return false;
    }
    console.log(`✅ Practitioner qualification updated`);
    return true;
  } catch (error) {
    console.error("Error updating practitioner qualification:", error);
    return false;
  }
}

async function getPractitionerRetryCount(
  supabase: ReturnType<typeof createClient>,
  practitionerId: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("practitioners")
      .select("retry_count")
      .eq("id", practitionerId)
      .single();
    if (error || !data) return 0;
    return data.retry_count || 0;
  } catch {
    return 0;
  }
}

// LLM-based natural language date parsing
async function parseNaturalLanguageDate(
  dateString: string,
  referenceDate?: Date
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY not configured, skipping date parsing");
    return null;
  }

  // First try native parsing - if it works, use it
  try {
    const nativeDate = new Date(dateString);
    if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() > 2020) {
      return nativeDate.toISOString();
    }
  } catch {
    // Continue to LLM parsing
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const now = referenceDate || new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timezone = Deno.env.get("BUSINESS_TIMEZONE") || "America/Toronto"; // EST/EDT

    const prompt = `Convert this natural language date/time to an ISO 8601 timestamp.

Current date: ${currentDate} (${currentDay})
Timezone: ${timezone}

Input: "${dateString}"

Rules:
- If a day of week is mentioned (e.g., "Tuesday"), use the NEXT occurrence of that day
- If no time is specified, default to 2:00 PM (14:00)
- If "morning" is mentioned, use 10:00 AM
- If "afternoon" is mentioned, use 2:00 PM
- If "evening" is mentioned, use 5:00 PM
- Return ONLY the ISO 8601 timestamp (e.g., "2026-01-30T14:00:00-05:00")
- If the input cannot be parsed as a date/time, return "INVALID"

Output (just the timestamp, nothing else):`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    
    if (response === "INVALID" || !response) {
      console.log(`⚠️ Could not parse date: "${dateString}"`);
      return null;
    }

    // Validate the returned date
    const parsedDate = new Date(response);
    if (isNaN(parsedDate.getTime())) {
      console.log(`⚠️ LLM returned invalid date format: "${response}"`);
      return null;
    }

    console.log(`✅ Parsed "${dateString}" → ${parsedDate.toISOString()}`);
    return parsedDate.toISOString();
  } catch (error) {
    console.error("❌ LLM date parsing failed:", error);
    return null;
  }
}

// LLM-based variable extraction from transcript (fallback when pathway extraction is sparse)
interface ExtractedVariables {
  contact_name?: string;
  contact_role?: string;
  contact_email?: string;
  decision_maker?: boolean;
  practice_name?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  practice_size?: number;
  patient_volume?: string;
  interest_level?: string;
  pain_points?: string;
  current_solutions?: string;
  objections?: string;
  best_callback_time?: string;
  follow_up_action?: string;
  follow_up_date?: string;
  decision_timeline?: string;
  appointment_time?: string;
  products_interested?: string;
  wants_sample?: boolean;
  wants_demo?: boolean;
  sample_quantity?: number;
}

async function extractVariablesFromTranscript(
  transcript: string
): Promise<ExtractedVariables> {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY not configured, skipping LLM extraction");
    return {};
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `Analyze this sales call transcript and extract all available information.
Return ONLY valid JSON (no markdown code blocks). Use null for anything not mentioned.

{
  "contact_name": "name of person on the call or null",
  "contact_role": "owner|office_manager|receptionist|practitioner|other or null",
  "contact_email": "email address if mentioned or null",
  "decision_maker": true if they make purchasing decisions, false if not, null if unclear,
  "practice_name": "name of clinic/practice/business or null",
  "address": "street address if mentioned or null",
  "city": "city name or null",
  "province": "province/state or null",
  "postal_code": "postal/zip code or null",
  "practice_size": number of practitioners/staff or null,
  "patient_volume": "description of patient volume (e.g. '50 patients per week') or null",
  "interest_level": "high|medium|low|not_interested based on their enthusiasm, or null",
  "pain_points": "challenges/problems they mentioned or null",
  "current_solutions": "what products/solutions they currently use or null",
  "objections": "concerns or hesitations they raised or null",
  "best_callback_time": "preferred time to call back or null",
  "follow_up_action": "send_info|callback|sample|demo|none based on agreed next steps, or null",
  "follow_up_date": "specific date/time mentioned for follow-up or null",
  "decision_timeline": "when they said they'd make a decision or null",
  "appointment_time": "scheduled appointment/demo time or null",
  "products_interested": "SuperPatch products mentioned (Freedom, Liberty, REM, Victory, Focus, Ignite, Kick It, Defend, Joy, Lumi, Rocket, Peace, Boost) or null",
  "wants_sample": true if they requested samples, false if declined, null if not discussed,
  "wants_demo": true if they want a demo/appointment, false if declined, null if not discussed,
  "sample_quantity": number of samples requested or null
}

Be precise. Only include information explicitly stated in the transcript.

TRANSCRIPT:
${transcript}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Clean up response - remove markdown code blocks if present
    const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
    const extracted = JSON.parse(jsonStr);
    
    // Filter out null values
    const filtered: ExtractedVariables = {};
    for (const [key, value] of Object.entries(extracted)) {
      if (value !== null && value !== undefined && value !== "") {
        (filtered as Record<string, unknown>)[key] = value;
      }
    }
    
    console.log(`✅ LLM extracted ${Object.keys(filtered).length} variables from transcript`);
    return filtered;
  } catch (error) {
    console.error("❌ LLM extraction failed:", error);
    return {};
  }
}

// Webhook signature verification using HMAC SHA-256
async function verifyWebhookSignature(
  secret: string,
  payload: string,
  signature: string | null
): Promise<boolean> {
  if (!signature || !secret) {
    console.warn("⚠️ Missing signature or secret for verification");
    return false;
  }
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Timing-safe comparison to prevent timing attacks
    if (expectedSignature.length !== signature.length) {
      console.warn("⚠️ Signature length mismatch");
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    
    return result === 0;
  } catch (error) {
    console.error("❌ Error verifying signature:", error);
    return false;
  }
}

// CORS helper
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
if (ALLOWED_ORIGIN === "*") {
  console.warn("⚠️ ALLOWED_ORIGIN not set - using wildcard CORS. Set ALLOWED_ORIGIN in production!");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
  };
}

// Main webhook handler
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  // GET endpoint for testing
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Bland.ai webhook processor (Edge Function)",
        features: [
          "Receives call completion webhooks",
          "Saves call records to Supabase database",
          "Links calls to practitioners by phone lookup",
          "Extracts scheduling variables",
          "Triggers book-appointment edge function for demos",
          "Creates appointment records in appointments table",
          "Stores transcripts and summaries",
          "Tracks voicemail status",
          "Creates sample requests when requested",
          "Smart retry scheduling for voicemail/failed calls",
          "DNC detection and automatic marking",
          "Extracts qualification data",
          "Enhanced lead scoring",
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("🔔 WEBHOOK RECEIVED - Edge Function processing...");

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    
    console.log("🔐 Webhook details:", {
      signature_present: !!signature,
      secret_configured: !!BLAND_WEBHOOK_SECRET,
      body_length: rawBody.length,
    });

    // Webhook signature verification
    if (BLAND_WEBHOOK_SECRET) {
      const isValid = await verifyWebhookSignature(BLAND_WEBHOOK_SECRET, rawBody, signature);
      if (!isValid) {
        console.error("❌ Invalid webhook signature - rejecting request");
        return new Response(
          JSON.stringify({ status: "error", message: "Invalid webhook signature" }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
      console.log("✅ Webhook signature verified successfully");
    } else {
      console.warn("⚠️ BLAND_WEBHOOK_SECRET not configured - skipping signature verification. Set this secret in production!");
    }

    // Parse the body after verification
    const payload: BlandWebhookPayload = JSON.parse(rawBody);
    
    console.log("📞 Received Bland webhook:", {
      call_id: payload.call_id,
      status: payload.status,
      to: payload.to,
      completed: payload.completed,
      call_length: payload.call_length,
      answered_by: payload.answered_by,
    });

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let vars = payload.variables || {};
    const meta = payload.metadata || {};

    // LLM Fallback: Extract variables from transcript when pathway extraction is sparse
    const hasTranscript = payload.concatenated_transcript?.length > 100;
    const callSucceeded = payload.completed && payload.call_length > 30;
    const pathwayExtractedLittle = Object.keys(vars).length < 5;

    if (hasTranscript && callSucceeded && GEMINI_API_KEY && pathwayExtractedLittle) {
      console.log(`🔍 Pathway extracted only ${Object.keys(vars).length} variables, running LLM fallback extraction...`);
      try {
        const extracted = await extractVariablesFromTranscript(payload.concatenated_transcript);
        
        // Merge extracted values into vars (only fills gaps, doesn't overwrite)
        const enrichedVars: Record<string, string> = { ...vars };
        let enrichedCount = 0;
        
        for (const [key, value] of Object.entries(extracted)) {
          if (value !== undefined && value !== null && !vars[key]) {
            enrichedVars[key] = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
            enrichedCount++;
          }
        }
        
        if (enrichedCount > 0) {
          console.log(`✅ LLM enriched vars with ${enrichedCount} additional variables`);
          vars = enrichedVars;
        }
      } catch (error) {
        console.error("❌ LLM fallback extraction failed:", error);
        // Continue with original sparse vars
      }
    }

    // Extract variables — handle both string "true" and boolean true from Bland pathways
    const wantsDemo = String(vars.wants_demo).toLowerCase() === "true" || 
                      String(vars.schedule_demo).toLowerCase() === "true" ||
                      vars.wants_demo === true || vars.schedule_demo === true;
    const appointmentTime = vars.appointment_time || vars.preferred_time || vars.start_time;
    const practitionerName = vars.practitioner_name || vars.name || vars.contact_name || meta.practice_name || meta.contact_name;
    const practitionerEmail = vars.email || vars.practitioner_email;
    const practitionerPhone = vars.best_phone || vars.phone || payload.to;
    const practiceAddress = vars.address || vars.practice_address || meta.address;
    const practiceName = vars.practice_name || meta.practice_name;
    const contactName = meta.contact_name || vars.contact_name;
    const practitionerType = vars.practitioner_type || meta.practitioner_type || meta.selected_pathway;
    const productsInterested = vars.products_interested || vars.sample_products || vars.products_requested || vars.products;
    const practitionerId = meta.practitioner_id || vars.practitioner_id;

    // Extract qualification data
    const qualificationData = extractQualificationData(vars, meta as Record<string, string | undefined>);
    console.log("📊 Extracted qualification data:", qualificationData);

    // Parse appointment time with LLM fallback for natural language dates
    let parsedAppointmentTime: string | null = null;
    if (appointmentTime) {
      // First try native parsing
      try {
        const nativeDate = new Date(appointmentTime);
        if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() > 2020) {
          parsedAppointmentTime = nativeDate.toISOString();
          console.log(`✅ Appointment time parsed natively: ${parsedAppointmentTime}`);
        }
      } catch {
        // Will fall through to LLM parsing
      }

      // If native parsing failed, try LLM parsing
      if (!parsedAppointmentTime) {
        console.log(`🔄 Attempting LLM date parsing for: "${appointmentTime}"`);
        parsedAppointmentTime = await parseNaturalLanguageDate(appointmentTime);
      }
    }

    // Resolve practitioner
    let resolvedPractitionerId: string | undefined | null = practitionerId;
    let resolvedPractitionerName = practitionerName || practiceName;
    let resolvedPractitionerType = practitionerType;
    let resolvedAddress = practiceAddress;
    let resolvedCity = meta.city;
    let resolvedProvince = meta.province;
    let resolvedEmail: string | undefined = undefined;

    if (!resolvedPractitionerId) {
      const foundPractitioner = await findPractitionerByPhone(supabase, payload.to);
      if (foundPractitioner) {
        resolvedPractitionerId = foundPractitioner.id;
        resolvedPractitionerName = resolvedPractitionerName || foundPractitioner.name;
        resolvedPractitionerType = resolvedPractitionerType || foundPractitioner.practitioner_type;
        resolvedAddress = resolvedAddress || foundPractitioner.address || undefined;
        resolvedCity = resolvedCity || foundPractitioner.city || undefined;
        resolvedProvince = resolvedProvince || foundPractitioner.province || undefined;
        resolvedEmail = getPractitionerEmail(foundPractitioner, vars.email || vars.practitioner_email, meta.clinic_email);
        console.log(`✅ Linked call to practitioner: ${foundPractitioner.name}`);
      } else {
        resolvedPractitionerId = undefined;
        const manualPracticeName = meta.practice_name || vars.practice_name;
        const manualContactName = meta.contact_name || vars.contact_name;
        if (manualPracticeName) {
          resolvedPractitionerName = manualContactName ? `${manualPracticeName} (${manualContactName})` : manualPracticeName;
        } else {
          resolvedPractitionerName = resolvedPractitionerName || vars.business_name || vars.company_name || "Unknown Caller";
        }
        resolvedPractitionerType = resolvedPractitionerType || meta.practitioner_type || vars.business_type || meta.selected_pathway || "Unknown";
        const streetAddress = meta.address || vars.address || vars.location;
        const postalCode = meta.postal_code || vars.postal_code;
        if (streetAddress) {
          resolvedAddress = postalCode ? `${streetAddress}, ${postalCode}` : streetAddress;
        }
        resolvedCity = resolvedCity || meta.city || undefined;
        resolvedProvince = resolvedProvince || meta.province || undefined;
        resolvedEmail = vars.email || vars.practitioner_email || meta.clinic_email || undefined;
        console.log(`📝 Recording call from unknown number: ${payload.to}`);
      }
    }

    if (!resolvedEmail) {
      resolvedEmail = vars.email || vars.practitioner_email || meta.clinic_email || undefined;
    }

    // Determine call status
    let callStatus: CallStatus = "completed";
    const wentToVoicemail = payload.voicemail_detected === true || payload.answered_by === "voicemail" ||
      payload.status === "voicemail" || vars.went_to_voicemail === "true" || vars.voicemail_left === "true";

    if (payload.status === "failed" || payload.status === "no-answer" || !payload.completed) {
      callStatus = "failed";
    } else if (wentToVoicemail) {
      callStatus = "voicemail" as CallStatus;
    } else if (wantsDemo || appointmentTime) {
      callStatus = "booked";
    }

    // Extract sentiment
    const sentimentLabel = payload.analysis?.sentiment?.toLowerCase() || null;
    const sentimentScore = payload.analysis?.sentiment_score || null;

    // Calculate lead score
    const leadScore = calculateLeadScore(payload, callStatus, qualificationData);

    // Save call record
    const callRecord = {
      practitioner_id: resolvedPractitionerId,
      practitioner_name: resolvedPractitionerName || "Unknown",
      practitioner_type: resolvedPractitionerType,
      phone: payload.to,
      address: resolvedAddress,
      city: resolvedCity,
      province: resolvedProvince,
      call_id: payload.call_id,
      status: callStatus,
      call_started_at: payload.created_at,
      call_ended_at: payload.ended_at,
      duration_seconds: payload.call_length ? Math.round(payload.call_length) : null,
      transcript: payload.concatenated_transcript,
      summary: payload.analysis?.summary,
      appointment_booked: callStatus === "booked" || callStatus === "calendar_sent",
      appointment_time: parsedAppointmentTime,
      calendar_invite_sent: false,
      practitioner_email: resolvedEmail || null,
      sentiment_label: sentimentLabel,
      sentiment_score: sentimentScore,
      recording_url: payload.recording_url || null,
      lead_score: leadScore,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("💾 Saving call record...");

    // Build update object without created_at (keep original timestamp)
    const updateData = {
      practitioner_id: callRecord.practitioner_id,
      practitioner_name: callRecord.practitioner_name,
      practitioner_type: callRecord.practitioner_type,
      phone: callRecord.phone,
      address: callRecord.address,
      city: callRecord.city,
      province: callRecord.province,
      status: callRecord.status,
      call_started_at: callRecord.call_started_at,
      call_ended_at: callRecord.call_ended_at,
      duration_seconds: callRecord.duration_seconds,
      transcript: callRecord.transcript,
      summary: callRecord.summary,
      appointment_booked: callRecord.appointment_booked,
      appointment_time: callRecord.appointment_time,
      calendar_invite_sent: callRecord.calendar_invite_sent,
      practitioner_email: callRecord.practitioner_email,
      sentiment_label: callRecord.sentiment_label,
      sentiment_score: callRecord.sentiment_score,
      recording_url: callRecord.recording_url,
      lead_score: callRecord.lead_score,
      updated_at: new Date().toISOString(),
    };

    // First try to UPDATE existing record by call_id
    const { data: updatedRecord, error: updateError } = await supabase
      .from("call_records")
      .update(updateData)
      .eq("call_id", payload.call_id)
      .select()
      .single();

    let savedRecord = updatedRecord;
    let saveError = updateError;

    console.log("📊 Update result:", { hasRecord: !!updatedRecord, error: updateError?.message });

    // If no existing record found (PGRST116 = no rows returned), insert new one
    if (updateError?.code === "PGRST116") {
      console.log("📝 No existing record, inserting new...");
      const { data: insertedRecord, error: insertError } = await supabase
        .from("call_records")
        .insert(callRecord)
        .select()
        .single();
      savedRecord = insertedRecord;
      saveError = insertError;
    }

    if (saveError && saveError.code !== "PGRST116") {
      console.error("❌ Failed to save call record:", saveError);
    } else if (savedRecord) {
      console.log("✅ Call record saved:", savedRecord.id);
    }

    // Trigger LLM analysis (fire and forget - don't await to avoid webhook timeout)
    if (savedRecord?.id && payload.concatenated_transcript && payload.concatenated_transcript.length > 50) {
      console.log("🔬 Triggering LLM analysis...");
      // Mark analysis as processing before triggering
      await supabase.from("call_records").update({ analysis_status: "processing" }).eq("id", savedRecord.id);
      fetchWithTimeout(`${SUPABASE_URL}/functions/v1/analyze-call`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          call_record_id: savedRecord.id,
          transcript: payload.concatenated_transcript,
          practitioner_id: resolvedPractitionerId,
          practitioner_type: resolvedPractitionerType,
          current_lead_score: leadScore,
        }),
      }).catch(async (err) => {
        console.error("Failed to trigger LLM analysis:", err);
        // Mark analysis as failed so the UI can show the error
        await supabase.from("call_records").update({ analysis_status: "failed" }).eq("id", savedRecord!.id);
      });
    }

    // Handle sample request (handle both string and boolean values from Bland)
    const wantsSample = 
      String(vars.wants_sample || "").toLowerCase() === "true" || 
      vars.wants_sample === true ||
      String(vars.sample_requested || "").toLowerCase() === "true" ||
      vars.sample_requested === true;
    if (wantsSample) {
      console.log("📦 Sample request detected...");
      const productsRaw = vars.products_interested || vars.sample_products || vars.products_requested || vars.products || "";
      let productsRequested: string[] | null = null;
      if (productsRaw && productsRaw !== "all" && productsRaw !== "standard_kit") {
        productsRequested = productsRaw.split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
      }

      const sampleRequest = {
        call_record_id: savedRecord?.id || null,
        practitioner_id: resolvedPractitionerId || null,
        requester_name: contactName || resolvedPractitionerName || "Unknown",
        practice_name: practiceName || resolvedPractitionerName,
        email: resolvedEmail || null,
        phone: payload.to,
        shipping_address: vars.sample_shipping_address || vars.shipping_address || resolvedAddress || null,
        shipping_city: vars.sample_shipping_city || vars.shipping_city || resolvedCity || null,
        shipping_province: vars.sample_shipping_province || vars.shipping_province || resolvedProvince || null,
        shipping_postal_code: vars.sample_postal_code || vars.shipping_postal_code || meta.postal_code || null,
        sample_type: productsRaw === "all" || !productsRaw ? "standard_kit" : "custom",
        products_requested: productsRequested,
        quantity: parseInt(vars.sample_quantity || "1", 10) || 1,
        notes: vars.sample_notes || null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: sampleData, error: sampleError } = await supabase
        .from("sample_requests")
        .insert(sampleRequest)
        .select()
        .single();

      if (sampleError) {
        console.error("❌ Failed to create sample request:", sampleError);
      } else {
        console.log("✅ Sample request created:", sampleData?.id);
        
        // Trigger sample confirmation email
        if (resolvedEmail) {
          try {
            await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/send-sample-confirmation`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                sample_request_id: sampleData?.id,
                practitioner_name: resolvedPractitionerName,
                practice_name: practiceName,
                email: resolvedEmail,
                products: productsRequested,
                shipping_address: sampleRequest.shipping_address,
                shipping_city: sampleRequest.shipping_city,
                shipping_province: sampleRequest.shipping_province,
                shipping_postal_code: sampleRequest.shipping_postal_code,
              }),
            });
            console.log("📧 Sample confirmation email triggered");
          } catch (emailError) {
            console.error("Failed to trigger sample confirmation:", emailError);
            // Mark confirmation as failed so it can be retried manually
            if (sampleData?.id) {
              await supabase.from("sample_requests").update({
                notes: `Email confirmation failed: ${emailError instanceof Error ? emailError.message : "Unknown error"}`,
              }).eq("id", sampleData.id);
            }
          }
        }
      }
    }

    // Check for DNC request
    const dncResult = detectDNCRequest(payload.concatenated_transcript || "");
    if (dncResult.detected && resolvedPractitionerId) {
      console.log(`🚫 DNC request detected - marking as Do Not Call`);
      await markPractitionerAsDNC(supabase, resolvedPractitionerId, `AI detected phrase: "${dncResult.matchedPhrase}"`, "ai_detected");
    }

    // Update practitioner qualification
    if (resolvedPractitionerId && Object.keys(qualificationData).length > 0 && !dncResult.detected) {
      await updatePractitionerQualification(supabase, resolvedPractitionerId, qualificationData);
    }

    // Smart retry logic
    let retryScheduled = false;
    let retryInfo: { scheduled: boolean; nextRetryAt: string | null; reason: string } | null = null;

    if (resolvedPractitionerId && !dncResult.detected) {
      if (callStatus === "voicemail" || callStatus === "failed") {
        // Use atomic increment to avoid race conditions with concurrent webhooks
        let currentRetryCount: number;
        try {
          const { data: rpcResult } = await supabase.rpc("increment_retry_count", { p_id: resolvedPractitionerId });
          // rpcResult is the NEW count after increment, so subtract 1 for the "current" value
          currentRetryCount = (rpcResult as number ?? 1) - 1;
        } catch {
          // Fallback to non-atomic read if RPC not available
          currentRetryCount = await getPractitionerRetryCount(supabase, resolvedPractitionerId);
        }
        retryInfo = await scheduleRetry(supabase, resolvedPractitionerId, callStatus, currentRetryCount);
        retryScheduled = retryInfo.scheduled;
        console.log("🔄 Retry scheduling result:", retryInfo);
      } else if (callStatus === "completed" || callStatus === "booked" || callStatus === "calendar_sent") {
        await clearRetryScheduling(supabase, resolvedPractitionerId);
      }
    }

    // Trigger appointment booking if needed (decoupled via edge function)
    // This will create both Cal.com booking AND appointment record in our table
    if (wantsDemo && parsedAppointmentTime && resolvedPractitionerName && resolvedEmail && payload.completed && savedRecord?.id) {
      // Check for existing appointment to prevent duplicates
      const { data: existingAppt } = await supabase
        .from("appointments")
        .select("id")
        .eq("call_record_id", savedRecord.id)
        .limit(1);
      
      if (existingAppt && existingAppt.length > 0) {
        console.log("⚠️ Appointment already exists for this call record, skipping duplicate booking");
      } else {
        console.log("🗓️ Triggering appointment booking with parsed time:", parsedAppointmentTime);
        try {
          await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/book-appointment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              call_record_id: savedRecord.id,
              practitioner_id: resolvedPractitionerId,
              practitioner_name: resolvedPractitionerName,
              practitioner_email: resolvedEmail,
              appointment_time: parsedAppointmentTime,
              phone: practitionerPhone,
              address: resolvedAddress,
              practitioner_type: resolvedPractitionerType,
              summary: payload.analysis?.summary,
              practice_name: practiceName,
              products: productsInterested,
              appointment_type: "demo",
            }),
          });
          console.log("📅 Appointment booking triggered (will create Cal.com booking + appointment record)");
        } catch (bookingError) {
          console.error("Failed to trigger booking:", bookingError);
          // Update call record so the failure is visible in the UI
          await supabase.from("call_records").update({
            notes: `Auto-booking failed: ${bookingError instanceof Error ? bookingError.message : "Unknown error"}. Manual booking needed.`,
          }).eq("id", savedRecord.id);
        }
      }
    } else if (wantsDemo && appointmentTime && !parsedAppointmentTime) {
      console.warn(`⚠️ Could not parse appointment time "${appointmentTime}" - booking skipped. Manual follow-up needed.`);
    }

    // Return response
    return new Response(
      JSON.stringify({
        status: "ok",
        message: callStatus === "voicemail" ? "Voicemail detected" : callStatus === "failed" ? "Call failed" : "Call processed",
        record_saved: !!savedRecord,
        retry_scheduled: retryScheduled,
        retry_info: retryInfo,
        call_id: payload.call_id,
        lead_score: leadScore,
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
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({ status: "error", message: String(error) }),
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
