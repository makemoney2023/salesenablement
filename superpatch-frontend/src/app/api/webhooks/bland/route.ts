/**
 * @deprecated This Vercel webhook route is deprecated.
 * 
 * The primary webhook handler has been migrated to Supabase Edge Function:
 * https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor
 * 
 * Benefits of the Edge Function:
 * - Lower latency (same infrastructure as database)
 * - Better reliability (fewer moving parts)
 * - Centralized logging in Supabase dashboard
 * 
 * This route is kept as a fallback. New calls should use the Edge Function.
 * To fully migrate, update NEXT_PUBLIC_BLAND_WEBHOOK_URL environment variable.
 */

import { NextRequest, NextResponse } from "next/server";
import { serverUpsertCallRecord, serverUpdateByCallId } from "@/lib/db/call-records";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import type { 
  CallStatus, 
  CallRecordInsert, 
  SampleRequestInsert, 
  RetryReason, 
  RetryPolicy,
  InterestLevel,
  ContactRole,
  FollowUpAction,
  PractitionerQualification,
} from "@/lib/db/types";

const CAL_API_KEY = process.env.CAL_API_KEY || "";
const CAL_EVENT_TYPE_ID = Number(process.env.CAL_EVENT_TYPE_ID) || 4352394;

// Smart Retry Policy Configuration
const RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  retryDelays: [60, 240, 1440], // Minutes: 1hr, 4hr, 24hr
  voicemailAction: 'retry',
  failedAction: 'retry_next_business_day',
  businessHoursOnly: true,
  businessHours: {
    start: 9,   // 9 AM
    end: 17,    // 5 PM
    timezone: 'America/Toronto',
  },
};

// Helper to normalize phone numbers for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10); // Get last 10 digits
}

// Practitioner lookup result type
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
    data?: {
      emails?: string[];
    };
  } | null;
}

// Get best available email from practitioner data with fallback priority
function getPractitionerEmail(
  practitioner: PractitionerLookup | null,
  varsEmail?: string,
  metaEmail?: string
): string | undefined {
  // Priority: call-captured > metadata > stored contact_email > enrichment emails
  if (varsEmail) return varsEmail;
  if (metaEmail) return metaEmail;
  if (practitioner?.contact_email) return practitioner.contact_email;
  const enrichmentEmails = practitioner?.enrichment?.data?.emails;
  if (enrichmentEmails && enrichmentEmails.length > 0) {
    return enrichmentEmails[0];
  }
  return undefined;
}

// Look up practitioner by phone number in Supabase
async function findPractitionerByPhone(phone: string): Promise<PractitionerLookup | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return null;
  }
  
  try {
    const normalizedPhone = normalizePhone(phone);
    
    // Try exact match first
    const { data: exactMatch, error: exactError } = await supabaseAdmin
      .from('practitioners')
      .select('id, name, practitioner_type, address, city, province, phone, contact_email, enrichment')
      .eq('phone', phone)
      .limit(1)
      .single();
    
    if (!exactError && exactMatch) {
      const result = exactMatch as PractitionerLookup;
      console.log(`📍 Found practitioner by exact phone: ${result.name}`);
      return result;
    }
    
    // Try partial match (last 10 digits)
    const { data: partialMatches } = await supabaseAdmin
      .from('practitioners')
      .select('id, name, practitioner_type, address, city, province, phone, contact_email, enrichment')
      .not('phone', 'is', null)
      .limit(100);
    
    if (partialMatches) {
      const matches = partialMatches as PractitionerLookup[];
      for (const p of matches) {
        if (p.phone && normalizePhone(p.phone) === normalizedPhone) {
          console.log(`📍 Found practitioner by normalized phone: ${p.name}`);
          return p;
        }
      }
    }
    
    console.log(`📍 No practitioner found for phone: ${phone}`);
    return null;
  } catch (error) {
    console.error('Error looking up practitioner by phone:', error);
    return null;
  }
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
  recording_url?: string;  // URL to call recording
  variables?: Record<string, string>;
  pathway_logs?: Record<string, unknown>[];
  analysis?: {
    summary?: string;
    sentiment?: string;  // "positive", "neutral", "negative"
    sentiment_score?: number;  // 0-1 score
    keywords?: string[];
    [key: string]: unknown;
  };
  metadata?: {
    practitioner_id?: string;
    practice_name?: string;
    contact_name?: string;  // Contact/Dr name for manual quick calls
    practitioner_type?: string;
    campaign?: string;
    source?: string;
    address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    clinic_email?: string;
    call_language?: string;
    selected_pathway?: string;  // For manual quick calls
  };
  // Voicemail detection fields
  voicemail_detected?: boolean;
  answered_by?: "human" | "voicemail" | "unknown";
}

// Calculate lead score based on call outcomes and qualification data
function calculateLeadScore(
  payload: BlandWebhookPayload, 
  callStatus: string,
  qualification?: Partial<PractitionerQualification>
): number {
  let score = 0;
  
  // Answered by human: +30
  if (payload.answered_by === "human") {
    score += 30;
  }
  
  // Call duration > 2 minutes: +20
  if (payload.call_length > 120) {
    score += 20;
  }
  
  // Demo booked: +50
  if (callStatus === "booked" || callStatus === "calendar_sent") {
    score += 50;
  }
  
  // Sample requested: +25
  const vars = payload.variables || {};
  if (vars.wants_sample === "true" || vars.sample_requested === "true") {
    score += 25;
  }
  
  // Sentiment: +15 positive, -10 negative
  const sentiment = payload.analysis?.sentiment?.toLowerCase();
  if (sentiment === "positive") {
    score += 15;
  } else if (sentiment === "negative") {
    score -= 10;
  }
  
  // Voicemail: -20
  if (payload.voicemail_detected || payload.answered_by === "voicemail") {
    score -= 20;
  }
  
  // Failed call: -30
  if (!payload.completed || payload.status === "failed") {
    score -= 30;
  }

  // === NEW: Qualification-based scoring ===
  
  // Interest level scoring
  if (qualification?.interest_level) {
    switch (qualification.interest_level) {
      case 'high':
        score += 30;
        break;
      case 'medium':
        score += 15;
        break;
      case 'low':
        score += 5;
        break;
      case 'not_interested':
        score -= 20;
        break;
    }
  }

  // Decision maker bonus: +20
  if (qualification?.decision_maker === true) {
    score += 20;
  }

  // Contact email captured: +10
  if (qualification?.contact_email) {
    score += 10;
  }

  // Follow-up action agreed: +10-25 depending on action
  if (qualification?.follow_up_action) {
    switch (qualification.follow_up_action) {
      case 'demo':
        score += 25;
        break;
      case 'sample':
        score += 20;
        break;
      case 'callback':
        score += 15;
        break;
      case 'send_info':
        score += 10;
        break;
      case 'none':
        score -= 5;
        break;
    }
  }

  // Practice size bonus (larger practices = more potential)
  if (qualification?.practice_size) {
    if (qualification.practice_size >= 5) {
      score += 15;
    } else if (qualification.practice_size >= 3) {
      score += 10;
    } else if (qualification.practice_size >= 2) {
      score += 5;
    }
  }
  
  return Math.max(0, Math.min(100, score)); // Keep between 0-100
}

// Do Not Call (DNC) phrases to detect in transcripts
const DNC_PHRASES = [
  "don't call",
  "do not call",
  "stop calling",
  "remove me",
  "take me off",
  "not interested",
  "never call again",
  "unsubscribe",
  "remove my number",
  "don't contact",
  "do not contact",
  "no more calls",
  "quit calling",
];

// Detect DNC request in transcript
function detectDNCRequest(transcript: string): { detected: boolean; matchedPhrase: string | null } {
  if (!transcript) {
    return { detected: false, matchedPhrase: null };
  }
  
  const lowerTranscript = transcript.toLowerCase();
  
  for (const phrase of DNC_PHRASES) {
    if (lowerTranscript.includes(phrase)) {
      console.log(`🚫 DNC phrase detected: "${phrase}"`);
      return { detected: true, matchedPhrase: phrase };
    }
  }
  
  return { detected: false, matchedPhrase: null };
}

// Mark practitioner as Do Not Call
async function markPractitionerAsDNC(
  practitionerId: string,
  reason: string,
  source: 'ai_detected' | 'manual' = 'ai_detected'
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    console.error("Cannot mark DNC: Supabase not configured");
    return false;
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('practitioners')
      .update({
        do_not_call: true,
        dnc_reason: reason,
        dnc_detected_at: new Date().toISOString(),
        dnc_source: source,
      })
      .eq('id', practitionerId);

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

// Calculate next retry time based on business hours
function calculateNextRetryTime(
  delayMinutes: number,
  businessHoursOnly: boolean,
  businessHours: { start: number; end: number; timezone: string }
): Date {
  const now = new Date();
  let nextRetry = new Date(now.getTime() + delayMinutes * 60 * 1000);

  if (!businessHoursOnly) {
    return nextRetry;
  }

  // Get hour in business timezone (simplified - using UTC offset for Toronto)
  // In production, use a proper timezone library like date-fns-tz
  const getBusinessHour = (date: Date): number => {
    // Toronto is UTC-5 (EST) or UTC-4 (EDT)
    // Simplified: assume EST (-5)
    const utcHour = date.getUTCHours();
    return (utcHour - 5 + 24) % 24;
  };

  const getBusinessDay = (date: Date): number => {
    // Adjust for timezone
    const utcDay = date.getUTCDay();
    const utcHour = date.getUTCHours();
    // If it's before midnight in Toronto but after in UTC, adjust day
    if (utcHour < 5) {
      return (utcDay - 1 + 7) % 7;
    }
    return utcDay;
  };

  // Check if time is within business hours
  const isBusinessHours = (date: Date): boolean => {
    const hour = getBusinessHour(date);
    const day = getBusinessDay(date);
    
    // Weekend check (0 = Sunday, 6 = Saturday)
    if (day === 0 || day === 6) return false;
    
    // Business hours check
    return hour >= businessHours.start && hour < businessHours.end;
  };

  // If not in business hours, move to next business hour
  let maxIterations = 7 * 24; // Max 1 week of hourly checks
  while (!isBusinessHours(nextRetry) && maxIterations > 0) {
    // Move forward by 1 hour
    nextRetry = new Date(nextRetry.getTime() + 60 * 60 * 1000);
    maxIterations--;
  }

  return nextRetry;
}

// Schedule a retry for a practitioner
async function scheduleRetry(
  practitionerId: string,
  callStatus: CallStatus,
  currentRetryCount: number
): Promise<{ scheduled: boolean; nextRetryAt: string | null; reason: string }> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return { scheduled: false, nextRetryAt: null, reason: "Supabase not configured" };
  }

  // Determine retry reason
  let retryReason: RetryReason;
  let shouldRetry = false;
  let delayMinutes: number;

  if (callStatus === "voicemail") {
    if (RETRY_POLICY.voicemailAction === 'retry') {
      shouldRetry = currentRetryCount < RETRY_POLICY.maxAttempts;
      retryReason = 'voicemail_left';
      delayMinutes = RETRY_POLICY.retryDelays[currentRetryCount] || RETRY_POLICY.retryDelays[RETRY_POLICY.retryDelays.length - 1];
    } else {
      return { scheduled: false, nextRetryAt: null, reason: "Voicemail policy is skip/sms_followup" };
    }
  } else if (callStatus === "failed") {
    if (RETRY_POLICY.failedAction === 'retry' || RETRY_POLICY.failedAction === 'retry_next_business_day') {
      shouldRetry = currentRetryCount < RETRY_POLICY.maxAttempts;
      retryReason = 'call_failed';
      // For failed calls, use longer delay or next business day
      delayMinutes = RETRY_POLICY.failedAction === 'retry_next_business_day' 
        ? 1440 // 24 hours minimum
        : RETRY_POLICY.retryDelays[currentRetryCount] || 1440;
    } else {
      return { scheduled: false, nextRetryAt: null, reason: "Failed policy is manual_review" };
    }
  } else {
    return { scheduled: false, nextRetryAt: null, reason: "Status does not require retry" };
  }

  if (!shouldRetry) {
    return { scheduled: false, nextRetryAt: null, reason: `Max retry attempts (${RETRY_POLICY.maxAttempts}) reached` };
  }

  // Calculate next retry time
  const nextRetryTime = calculateNextRetryTime(
    delayMinutes,
    RETRY_POLICY.businessHoursOnly,
    RETRY_POLICY.businessHours
  );

  // Update practitioner with retry info
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('practitioners')
      .update({
        retry_count: currentRetryCount + 1,
        next_retry_at: nextRetryTime.toISOString(),
        retry_reason: retryReason,
        last_call_status: callStatus,
        last_call_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', practitionerId);

    if (error) {
      console.error("Error scheduling retry:", error);
      return { scheduled: false, nextRetryAt: null, reason: `Database error: ${error.message}` };
    }

    console.log(`🔄 Retry scheduled for practitioner ${practitionerId}:`);
    console.log(`   Reason: ${retryReason}`);
    console.log(`   Attempt: ${currentRetryCount + 1}/${RETRY_POLICY.maxAttempts}`);
    console.log(`   Next retry: ${nextRetryTime.toISOString()}`);

    return { 
      scheduled: true, 
      nextRetryAt: nextRetryTime.toISOString(), 
      reason: `Retry ${currentRetryCount + 1} scheduled for ${nextRetryTime.toISOString()}` 
    };
  } catch (error) {
    console.error("Error scheduling retry:", error);
    return { scheduled: false, nextRetryAt: null, reason: `Error: ${String(error)}` };
  }
}

// Clear retry scheduling after successful call
async function clearRetryScheduling(practitionerId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('practitioners')
      .update({
        next_retry_at: null,
        retry_reason: null,
        last_call_status: 'completed',
        last_call_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', practitionerId);

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

// Extract qualification data from call variables
function extractQualificationData(
  vars: Record<string, string>,
  meta: Record<string, string | undefined>
): Partial<PractitionerQualification> {
  const qualification: Partial<PractitionerQualification> = {};

  // Contact info
  const contactName = vars.contact_name || vars.spoke_with || meta.contact_name;
  if (contactName) qualification.contact_name = contactName;

  const contactRole = (vars.contact_role || vars.role || vars.position)?.toLowerCase();
  if (contactRole) {
    const validRoles: ContactRole[] = ['owner', 'office_manager', 'receptionist', 'practitioner', 'other'];
    qualification.contact_role = validRoles.includes(contactRole as ContactRole) 
      ? (contactRole as ContactRole) 
      : 'other';
  }

  const contactEmail = vars.email || vars.contact_email || vars.practitioner_email || meta.clinic_email;
  if (contactEmail) qualification.contact_email = contactEmail;

  const decisionMaker = vars.decision_maker || vars.is_decision_maker;
  if (decisionMaker) {
    qualification.decision_maker = decisionMaker.toLowerCase() === 'yes' || decisionMaker.toLowerCase() === 'true';
  }

  const bestCallbackTime = vars.best_callback_time || vars.callback_time || vars.preferred_time_to_call;
  if (bestCallbackTime) qualification.best_callback_time = bestCallbackTime;

  // Interest level
  const interestLevel = (vars.interest_level || vars.interest)?.toLowerCase();
  if (interestLevel) {
    const validLevels: InterestLevel[] = ['high', 'medium', 'low', 'not_interested'];
    qualification.interest_level = validLevels.includes(interestLevel as InterestLevel)
      ? (interestLevel as InterestLevel)
      : undefined;
  }

  const painPoints = vars.pain_points || vars.challenges || vars.problems_mentioned;
  if (painPoints) qualification.pain_points = painPoints;

  const currentSolutions = vars.current_solutions || vars.current_products || vars.what_they_use;
  if (currentSolutions) qualification.current_solutions = currentSolutions;

  const objections = vars.objections || vars.concerns || vars.hesitations;
  if (objections) qualification.objections = objections;

  // Business info
  const practiceSize = vars.practice_size || vars.num_practitioners || vars.staff_size;
  if (practiceSize) {
    const size = parseInt(practiceSize, 10);
    if (!isNaN(size)) qualification.practice_size = size;
  }

  const patientVolume = vars.patient_volume || vars.patients_per_week || vars.weekly_patients;
  if (patientVolume) qualification.patient_volume = patientVolume;

  // Next steps
  const followUpAction = (vars.follow_up_action || vars.next_step || vars.agreed_action)?.toLowerCase();
  if (followUpAction) {
    const validActions: FollowUpAction[] = ['send_info', 'callback', 'sample', 'demo', 'none'];
    // Map common variations
    const actionMap: Record<string, FollowUpAction> = {
      'send_info': 'send_info',
      'send_information': 'send_info',
      'email_info': 'send_info',
      'callback': 'callback',
      'call_back': 'callback',
      'follow_up_call': 'callback',
      'sample': 'sample',
      'send_sample': 'sample',
      'demo': 'demo',
      'schedule_demo': 'demo',
      'book_demo': 'demo',
      'none': 'none',
      'no_action': 'none',
    };
    qualification.follow_up_action = actionMap[followUpAction] || 
      (validActions.includes(followUpAction as FollowUpAction) ? (followUpAction as FollowUpAction) : undefined);
  }

  const followUpDate = vars.follow_up_date || vars.callback_date || vars.next_call_date || vars.appointment_time;
  if (followUpDate) {
    try {
      const date = new Date(followUpDate);
      if (!isNaN(date.getTime())) {
        qualification.follow_up_date = date.toISOString();
      }
    } catch {
      // Keep as string if can't parse
      qualification.follow_up_date = followUpDate;
    }
  }

  const decisionTimeline = vars.decision_timeline || vars.when_deciding || vars.timeline;
  if (decisionTimeline) qualification.decision_timeline = decisionTimeline;

  // Sample/product interest (use consistent fallback chain)
  const productsInterested = vars.products_interested || vars.sample_products || vars.products_requested || vars.products;
  if (productsInterested) {
    qualification.products_interested = productsInterested;
  }

  const wantsSample = vars.wants_sample || (productsInterested ? 'true' : undefined);
  if (wantsSample) {
    qualification.wants_sample = wantsSample.toLowerCase() === 'true' || wantsSample.toLowerCase() === 'yes';
  }

  const wantsDemo = vars.wants_demo;
  if (wantsDemo) {
    qualification.wants_demo = wantsDemo.toLowerCase() === 'true' || wantsDemo.toLowerCase() === 'yes';
  }

  return qualification;
}

// Update practitioner with qualification data
async function updatePractitionerQualification(
  practitionerId: string,
  qualification: Partial<PractitionerQualification>
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    console.log("Cannot update qualification: Supabase not configured");
    return false;
  }

  // Only update if we have data to update
  const fieldsToUpdate = Object.entries(qualification).filter(([, v]) => v !== undefined && v !== null);
  if (fieldsToUpdate.length === 0) {
    console.log("No qualification data to update");
    return true;
  }

  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Add non-null qualification fields
    for (const [key, value] of fieldsToUpdate) {
      updateData[key] = value;
    }

    console.log(`📊 Updating practitioner ${practitionerId} with qualification data:`, updateData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('practitioners')
      .update(updateData)
      .eq('id', practitionerId);

    if (error) {
      console.error("Error updating practitioner qualification:", error);
      return false;
    }

    console.log(`✅ Practitioner qualification updated successfully`);
    return true;
  } catch (error) {
    console.error("Error updating practitioner qualification:", error);
    return false;
  }
}

// Get current retry count for a practitioner
async function getPractitionerRetryCount(practitionerId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return 0;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('practitioners')
      .select('retry_count')
      .eq('id', practitionerId)
      .single();

    if (error || !data) {
      return 0;
    }

    return data.retry_count || 0;
  } catch {
    return 0;
  }
}

// POST /api/webhooks/bland - Handle Bland.ai call completion webhooks
// @deprecated - Use Supabase Edge Function webhook-processor instead
export async function POST(request: NextRequest) {
  console.log("🔔 WEBHOOK RECEIVED (Vercel - DEPRECATED) - Starting processing...");
  console.warn("⚠️ This webhook route is deprecated. Please use the Supabase Edge Function: webhook-processor");
  
  try {
    const payload: BlandWebhookPayload = await request.json();
    
    console.log("📞 Received Bland webhook:", {
      call_id: payload.call_id,
      status: payload.status,
      to: payload.to,
      completed: payload.completed,
      call_length: payload.call_length,
      answered_by: payload.answered_by,
      variables: payload.variables,
      metadata: payload.metadata,
    });
    
    console.log("🔧 Supabase configured:", isSupabaseConfigured);
    console.log("🔧 Supabase admin client:", !!supabaseAdmin);
    
    // Extract scheduling variables from the call
    const vars = payload.variables || {};
    const meta = payload.metadata || {};
    
    // Look for scheduling intent and data
    const wantsDemo = vars.wants_demo === "true" || vars.schedule_demo === "true";
    const appointmentTime = vars.appointment_time || vars.preferred_time || vars.start_time;
    // For practitioner name, check: call variables > metadata practice_name > metadata contact_name
    const practitionerName = vars.practitioner_name || vars.name || vars.contact_name || meta.practice_name || meta.contact_name;
    const practitionerEmail = vars.email || vars.practitioner_email;
    const practitionerPhone = vars.best_phone || vars.phone || payload.to;
    const practiceAddress = vars.address || vars.practice_address || meta.address;
    const practiceName = vars.practice_name || meta.practice_name;
    const contactName = meta.contact_name || vars.contact_name;  // Specific contact person
    const practitionerType = vars.practitioner_type || meta.practitioner_type || meta.selected_pathway;
    const productsInterested = vars.products_interested || vars.sample_products || vars.products_requested || vars.products;
    const practitionerId = meta.practitioner_id || vars.practitioner_id;
    
    console.log("📋 Extracted variables:", {
      wantsDemo,
      appointmentTime,
      practitionerName,
      practitionerEmail,
      practiceAddress,
      practitionerId,
    });

    // Extract qualification data from call variables
    const qualificationData = extractQualificationData(vars, meta as Record<string, string | undefined>);
    console.log("📊 Extracted qualification data:", qualificationData);
    
    // Try to find practitioner by phone if not provided in metadata
    let resolvedPractitionerId: string | undefined | null = practitionerId;
    let resolvedPractitionerName = practitionerName || practiceName;
    let resolvedPractitionerType = practitionerType;
    let resolvedAddress = practiceAddress;
    let resolvedCity = meta.city;
    let resolvedProvince = meta.province;
    let resolvedEmail: string | undefined = undefined;
    
    if (!resolvedPractitionerId) {
      const foundPractitioner = await findPractitionerByPhone(payload.to);
      if (foundPractitioner) {
        resolvedPractitionerId = foundPractitioner.id;
        resolvedPractitionerName = resolvedPractitionerName || foundPractitioner.name;
        resolvedPractitionerType = resolvedPractitionerType || foundPractitioner.practitioner_type;
        resolvedAddress = resolvedAddress || foundPractitioner.address || undefined;
        resolvedCity = resolvedCity || foundPractitioner.city || undefined;
        resolvedProvince = resolvedProvince || foundPractitioner.province || undefined;
        // Use stored email with fallback priority: call vars > metadata > stored contact_email > enrichment emails
        resolvedEmail = getPractitionerEmail(
          foundPractitioner,
          vars.email || vars.practitioner_email,
          meta.clinic_email
        );
        
        console.log(`✅ Linked call to practitioner: ${foundPractitioner.name} (${foundPractitioner.id})`);
      } else {
        // Unknown caller - practitioner_id will be NULL
        // Extract whatever info we can from the call variables and metadata
        resolvedPractitionerId = undefined; // Will be NULL in DB
        
        // For manual quick calls, use the practice name or contact name from metadata
        const manualPracticeName = meta.practice_name || vars.practice_name;
        const manualContactName = meta.contact_name || vars.contact_name;
        
        // Build a display name from available info
        if (manualPracticeName) {
          resolvedPractitionerName = manualContactName 
            ? `${manualPracticeName} (${manualContactName})`
            : manualPracticeName;
        } else {
          resolvedPractitionerName = resolvedPractitionerName || vars.business_name || vars.company_name || "Unknown Caller";
        }
        
        resolvedPractitionerType = resolvedPractitionerType || meta.practitioner_type || vars.business_type || meta.selected_pathway || "Unknown";
        
        // Build address from metadata - include postal code if available
        const streetAddress = meta.address || vars.address || vars.location;
        const postalCode = meta.postal_code || vars.postal_code;
        if (streetAddress) {
          resolvedAddress = postalCode ? `${streetAddress}, ${postalCode}` : streetAddress;
        } else {
          resolvedAddress = resolvedAddress || undefined;
        }
        
        resolvedCity = resolvedCity || meta.city || undefined;
        resolvedProvince = resolvedProvince || meta.province || undefined;
        // For unknown callers, use email from call vars or metadata
        resolvedEmail = vars.email || vars.practitioner_email || meta.clinic_email || undefined;
        
        console.log(`📝 Recording call from unknown number: ${payload.to}`);
        console.log(`   Name: ${resolvedPractitionerName}`);
        console.log(`   Type: ${resolvedPractitionerType}`);
        console.log(`   Address: ${resolvedAddress}`);
        console.log(`   Location: ${resolvedCity}, ${resolvedProvince}`);
        console.log(`   Email: ${resolvedEmail || 'none'}`);
        console.log(`   Source: ${meta.source}`);
      }
    }
    
    // If we had a practitioner ID from metadata but didn't go through findPractitionerByPhone,
    // still try to resolve email from call variables/metadata
    if (!resolvedEmail) {
      resolvedEmail = vars.email || vars.practitioner_email || meta.clinic_email || undefined;
    }
    
    // Determine call status
    let callStatus: CallStatus = "completed";
    
    // Check for voicemail first
    const wentToVoicemail = 
      payload.voicemail_detected === true ||
      payload.answered_by === "voicemail" ||
      payload.status === "voicemail" ||
      vars.went_to_voicemail === "true" ||
      vars.voicemail_left === "true";
    
    if (payload.status === "failed" || payload.status === "no-answer" || !payload.completed) {
      callStatus = "failed";
    } else if (wentToVoicemail) {
      // Voicemail was left - track separately for follow-up
      callStatus = "voicemail" as CallStatus;
    } else if (wantsDemo || appointmentTime) {
      callStatus = "booked";
    }
    
    // If they want a demo and we have enough info, book it
    let bookingResult: { id: string; uid: string } | null = null;
    
    if (wantsDemo && appointmentTime && resolvedPractitionerName && resolvedEmail && payload.completed) {
      console.log("🗓️ Attempting to book Cal.com appointment...");

      try {
        bookingResult = await bookCalComAppointment({
          startTime: appointmentTime,
          name: resolvedPractitionerName,
          email: resolvedEmail,
          phone: practitionerPhone,
          address: resolvedAddress,
          practiceName: resolvedPractitionerName,
          practitionerType: resolvedPractitionerType,
          products: productsInterested,
          callId: payload.call_id,
          summary: payload.analysis?.summary,
        });

        console.log("✅ Booking successful:", bookingResult);
        callStatus = "calendar_sent";
      } catch (bookingError) {
        console.error("❌ Booking failed:", bookingError);
        // Keep status as "booked" since they wanted a demo
      }
    }
    
    // Extract sentiment data from analysis
    const sentimentLabel = payload.analysis?.sentiment?.toLowerCase() || null;
    const sentimentScore = payload.analysis?.sentiment_score || null;
    
    // Calculate lead score based on call outcomes and qualification data
    const leadScore = calculateLeadScore(payload, callStatus, qualificationData);
    
    console.log("📊 Call analysis:", {
      sentiment: sentimentLabel,
      sentiment_score: sentimentScore,
      lead_score: leadScore,
      recording_url: payload.recording_url ? "present" : "none",
    });

    // Save to database - use resolved practitioner data
    const callRecord: CallRecordInsert = {
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
      duration_seconds: payload.call_length,
      transcript: payload.concatenated_transcript,
      summary: payload.analysis?.summary,
      appointment_booked: callStatus === "booked" || callStatus === "calendar_sent",
      appointment_time: appointmentTime ? new Date(appointmentTime).toISOString() : null,
      calendar_invite_sent: callStatus === "calendar_sent",
      practitioner_email: resolvedEmail || null,
      booking_id: bookingResult?.id,
      // New sentiment and scoring fields
      sentiment_label: sentimentLabel,
      sentiment_score: sentimentScore,
      recording_url: payload.recording_url || null,
      lead_score: leadScore,
    };
    
    // Try to update existing record by call_id first, then upsert
    let savedRecord = null;
    
    console.log("💾 Attempting to save call record:", {
      practitioner_id: callRecord.practitioner_id,
      phone: callRecord.phone,
      status: callRecord.status,
      call_id: callRecord.call_id,
    });
    
    // First, try to update by call_id (in case call is already in progress)
    savedRecord = await serverUpdateByCallId(payload.call_id, callRecord);
    console.log("💾 Update by call_id result:", savedRecord ? "success" : "no existing record");
    
    if (!savedRecord) {
      // If no existing record, upsert with practitioner_id
      console.log("💾 Trying upsert with practitioner_id:", callRecord.practitioner_id);
      savedRecord = await serverUpsertCallRecord(callRecord);
      console.log("💾 Upsert result:", savedRecord ? "success" : "failed");
    }
    
    if (savedRecord) {
      console.log("✅ Call record saved to database:", {
        id: savedRecord.id,
        status: savedRecord.status,
        practitioner_id: savedRecord.practitioner_id,
      });
      
      // Auto-create call note with AI summary
      if (payload.analysis?.summary && isSupabaseConfigured && supabaseAdmin) {
        console.log("📝 Creating auto call note with AI summary...");
        
        // Build note content with summary and key details
        const noteLines = [
          `📞 **AI Call Summary**`,
          ``,
          payload.analysis.summary,
          ``,
          `---`,
          `*Call Duration:* ${Math.round(payload.call_length / 60)} min ${payload.call_length % 60} sec`,
          payload.answered_by ? `*Answered By:* ${payload.answered_by}` : null,
          sentimentLabel ? `*Sentiment:* ${sentimentLabel}${sentimentScore ? ` (${Math.round(sentimentScore * 100)}%)` : ''}` : null,
          leadScore ? `*Lead Score:* ${leadScore}/100` : null,
        ].filter(Boolean).join('\n');
        
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: noteData, error: noteError } = await (supabaseAdmin as any)
            .from("call_notes")
            .insert({
              call_record_id: savedRecord.id,
              content: noteLines,
              created_by: "AI Assistant",
            })
            .select()
            .single();
          
          if (noteError) {
            console.error("❌ Failed to create call note:", noteError.message);
          } else {
            console.log("✅ Call note created:", noteData.id);
          }
        } catch (err) {
          console.error("❌ Error creating call note:", err);
        }
      }
    } else {
      console.error("❌ Failed to save call record to database - check Supabase connection");
    }
    
    // Handle sample request if requested
    const wantsSample = vars.wants_sample === "true" || vars.sample_requested === "true";
    
    if (wantsSample && isSupabaseConfigured && supabaseAdmin) {
      console.log("📦 Sample request detected - creating sample request record...");
      
      // Parse products requested (use consistent fallback chain)
      const productsRaw = vars.products_interested || vars.sample_products || vars.products_requested || vars.products || "";
      let productsRequested: string[] | null = null;
      
      if (productsRaw && productsRaw !== "all" && productsRaw !== "standard_kit") {
        productsRequested = productsRaw.split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
      }
      
      const sampleType = productsRaw === "all" || !productsRaw ? "standard_kit" : "custom";
      
      // Use shipping address if provided, otherwise use practice address
      const shippingAddress = vars.sample_shipping_address || vars.shipping_address || resolvedAddress;
      const shippingCity = vars.sample_shipping_city || vars.shipping_city || resolvedCity;
      const shippingProvince = vars.sample_shipping_province || vars.shipping_province || resolvedProvince;
      const shippingPostalCode = vars.sample_postal_code || vars.shipping_postal_code || meta.postal_code;
      
      const sampleRequest: SampleRequestInsert = {
        call_record_id: savedRecord?.id || null,
        practitioner_id: resolvedPractitionerId || null,
        requester_name: contactName || resolvedPractitionerName || "Unknown",
        practice_name: practiceName || resolvedPractitionerName,
        email: resolvedEmail || null,
        phone: payload.to,
        shipping_address: shippingAddress || null,
        shipping_city: shippingCity || null,
        shipping_province: shippingProvince || null,
        shipping_postal_code: shippingPostalCode || null,
        sample_type: sampleType,
        products_requested: productsRequested,
        quantity: parseInt(vars.sample_quantity || "1", 10) || 1,
        notes: vars.sample_notes || null,
        status: "pending",
      };
      
      try {
        // Use type assertion for new table not yet in Supabase types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sampleData, error: sampleError } = await (supabaseAdmin as any)
          .from("sample_requests")
          .insert(sampleRequest)
          .select()
          .single();
        
        if (sampleError) {
          console.error("❌ Failed to create sample request:", sampleError.message);
        } else {
          console.log("✅ Sample request created:", {
            id: sampleData.id,
            requester: sampleData.requester_name,
            products: sampleData.products_requested || "standard_kit",
            shipping_city: sampleData.shipping_city,
          });
        }
      } catch (err) {
        console.error("❌ Error creating sample request:", err);
      }
    }
    
    // Log for manual follow-up if demo requested but booking failed
    if (wantsDemo && !bookingResult) {
      console.log("📝 MANUAL FOLLOW-UP NEEDED:");
      console.log({
        call_id: payload.call_id,
        phone: payload.to,
        timestamp: payload.ended_at,
        variables: vars,
        transcript_preview: payload.concatenated_transcript?.slice(0, 500),
      });
    }
    
    // Check for Do Not Call (DNC) request in transcript
    const dncResult = detectDNCRequest(payload.concatenated_transcript || "");
    if (dncResult.detected && resolvedPractitionerId) {
      console.log(`🚫 DNC request detected for ${resolvedPractitionerName} - marking as Do Not Call`);
      const dncMarked = await markPractitionerAsDNC(
        resolvedPractitionerId,
        `AI detected phrase: "${dncResult.matchedPhrase}"`,
        'ai_detected'
      );
      if (dncMarked) {
        console.log(`✅ Practitioner ${resolvedPractitionerName} successfully marked as DNC`);
      }
    }

    // Update practitioner with qualification data (if we have a practitioner and data)
    let qualificationUpdated = false;
    if (resolvedPractitionerId && Object.keys(qualificationData).length > 0 && !dncResult.detected) {
      qualificationUpdated = await updatePractitionerQualification(resolvedPractitionerId, qualificationData);
      if (qualificationUpdated) {
        console.log(`✅ Qualification data saved for practitioner ${resolvedPractitionerId}`);
      }
    }

    // Smart Retry Logic - Schedule retries for voicemail/failed calls
    let retryScheduled = false;
    let retryInfo: { scheduled: boolean; nextRetryAt: string | null; reason: string } | null = null;

    if (resolvedPractitionerId && !dncResult.detected) {
      if (callStatus === "voicemail" || callStatus === "failed") {
        // Get current retry count
        const currentRetryCount = await getPractitionerRetryCount(resolvedPractitionerId);
        
        // Schedule retry
        retryInfo = await scheduleRetry(resolvedPractitionerId, callStatus, currentRetryCount);
        retryScheduled = retryInfo.scheduled;
        
        console.log("🔄 Retry scheduling result:", retryInfo);
      } else if (callStatus === "completed" || callStatus === "booked" || callStatus === "calendar_sent") {
        // Clear any pending retries on successful call
        await clearRetryScheduling(resolvedPractitionerId);
      }
    }
    
    // Return appropriate response
    if (!payload.completed) {
      return NextResponse.json({ 
        status: "ok", 
        message: "Call not completed",
        record_saved: !!savedRecord,
      });
    }
    
    if (bookingResult) {
      return NextResponse.json({
        status: "success",
        message: "Appointment booked",
        booking_id: bookingResult.id,
        booking_uid: bookingResult.uid,
        record_saved: !!savedRecord,
      });
    }
    
    if (wantsDemo) {
      return NextResponse.json({
        status: "partial",
        message: "Demo requested but booking failed - logged for follow-up",
        record_saved: !!savedRecord,
      });
    }
    
    return NextResponse.json({
      status: "ok",
      message: callStatus === "voicemail" 
        ? "Voicemail detected" 
        : callStatus === "failed"
        ? "Call failed"
        : "Call completed - no booking requested",
      record_saved: !!savedRecord,
      retry_scheduled: retryScheduled,
      retry_info: retryInfo,
    });
    
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}

async function bookCalComAppointment(data: {
  startTime: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  practiceName?: string;
  practitionerType?: string;
  products?: string;
  callId: string;
  summary?: string;
}) {
  // Parse the start time and calculate end time (30 min later)
  const start = new Date(data.startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  
  // Build notes for sales team with full context
  const notes = [
    `Practice: ${data.practiceName || 'N/A'}`,
    `Type: ${data.practitionerType || 'N/A'}`,
    `Phone: ${data.phone || 'N/A'}`,
    `Products Interested: ${data.products || 'N/A'}`,
    `Address: ${data.address || 'TBD'}`,
    '',
    'Call Summary:',
    data.summary || 'No summary available',
  ].join('\n');
  
  const bookingPayload = {
    eventTypeId: CAL_EVENT_TYPE_ID,
    start: start.toISOString(),
    end: end.toISOString(),
    responses: {
      name: data.name,
      email: data.email,
      location: {
        value: "inPerson",
        optionValue: data.address || "TBD",
      },
    },
    timeZone: "America/New_York",
    language: "en",
    title: `SuperPatch Demo - ${data.practiceName || data.name}`,
    // Description field - this shows in calendar event details
    description: notes,
    metadata: {
      source: "bland_ai_webhook",
      call_id: data.callId,
      practice_name: data.practiceName,
      practitioner_type: data.practitionerType,
      practitioner_phone: data.phone,
      products_interested: data.products,
      call_summary: data.summary || "No summary available",
    },
  };
  
  console.log("📅 Cal.com booking payload:", JSON.stringify(bookingPayload, null, 2));
  
  const response = await fetch(`https://api.cal.com/v1/bookings?apiKey=${CAL_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bookingPayload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cal.com booking failed: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Test Supabase connection
  if (searchParams.get("test") === "supabase") {
    console.log("🧪 Testing Supabase connection...");
    console.log("🔧 isSupabaseConfigured:", isSupabaseConfigured);
    console.log("🔧 supabaseAdmin exists:", !!supabaseAdmin);
    
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json({
        status: "error",
        message: "Supabase not configured",
        debug: {
          isSupabaseConfigured,
          hasAdminClient: !!supabaseAdmin,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT_SET",
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT_SET",
          serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT_SET",
        }
      });
    }
    
    try {
      // Try to read from call_records
      const { error, count } = await supabaseAdmin
        .from('call_records')
        .select('*', { count: 'exact' })
        .limit(5);
      
      if (error) {
        return NextResponse.json({
          status: "error",
          message: "Supabase read failed",
          error: error.message,
          code: error.code,
        });
      }
      
      return NextResponse.json({
        status: "ok",
        message: "Supabase connection working",
        test_results: {
          read_success: true,
          records_found: count,
        },
      });
    } catch (err) {
      return NextResponse.json({
        status: "error",
        message: "Supabase test failed",
        error: String(err),
      });
    }
  }
  
  return NextResponse.json({
    status: "ok",
    message: "Bland.ai webhook endpoint ready",
    features: [
      "Receives call completion webhooks",
      "Saves call records to Supabase database",
      "Links calls to practitioners by phone lookup",
      "Extracts scheduling variables",
      "Books to Cal.com if demo requested",
      "Stores transcripts and summaries",
      "Tracks voicemail status",
      "Creates sample requests when requested",
      "Smart retry scheduling for voicemail/failed calls",
      "DNC detection and automatic marking",
      "Extracts qualification data (interest_level, decision_maker, etc.)",
      "Enhanced lead scoring with qualification factors",
    ],
    pathway_variables: {
      contact_info: [
        "contact_name - Name of person spoken to",
        "contact_role - owner/office_manager/receptionist/practitioner/other",
        "email - Email address for follow-up",
        "decision_maker - yes/no if they make purchasing decisions",
        "best_callback_time - Preferred time to call back",
      ],
      interest: [
        "interest_level - high/medium/low/not_interested",
        "pain_points - Challenges they mentioned",
        "current_solutions - What they currently use",
        "objections - Concerns or hesitations raised",
      ],
      business: [
        "practice_size - Number of practitioners",
        "patient_volume - Approx patients per week",
      ],
      next_steps: [
        "follow_up_action - send_info/callback/sample/demo/none",
        "follow_up_date - When to follow up",
        "decision_timeline - When they expect to decide",
      ],
    },
    retry_policy: {
      max_attempts: RETRY_POLICY.maxAttempts,
      retry_delays_minutes: RETRY_POLICY.retryDelays,
      voicemail_action: RETRY_POLICY.voicemailAction,
      failed_action: RETRY_POLICY.failedAction,
      business_hours_only: RETRY_POLICY.businessHoursOnly,
      business_hours: RETRY_POLICY.businessHours,
    },
    debug_endpoints: {
      test_supabase: "/api/webhooks/bland?test=supabase",
    },
    config: {
      supabase_configured: isSupabaseConfigured,
      has_admin_client: !!supabaseAdmin,
    }
  });
}
