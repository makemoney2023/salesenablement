// Supabase Edge Function for booking Cal.com appointments
// Triggered by database trigger when appointment_booked = true and booking_id is NULL
// @ts-nocheck - Deno types not available in IDE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCalBooking, CalError, type CalBookingResult } from "../_shared/cal.ts";
import { appendNoteLine } from "../_shared/notes.ts";
import { buildNotesUpdate } from "./notes.ts";
import { buildBookingResponse } from "./response.ts";

const CAL_API_KEY = Deno.env.get("CAL_API_KEY") ?? "";
const CAL_API_VERSION = Deno.env.get("CAL_API_VERSION");
const CAL_EVENT_TYPE_ID_RAW = Deno.env.get("CAL_EVENT_TYPE_ID");
const CAL_EVENT_TYPE_ID = Number(CAL_EVENT_TYPE_ID_RAW);
const BUSINESS_TIMEZONE = Deno.env.get("BUSINESS_TIMEZONE") ?? "America/Toronto";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!CAL_API_KEY) {
  throw new Error("CAL_API_KEY is required");
}
if (!CAL_EVENT_TYPE_ID_RAW || !Number.isFinite(CAL_EVENT_TYPE_ID) || CAL_EVENT_TYPE_ID <= 0) {
  throw new Error("CAL_EVENT_TYPE_ID is required and must match canonical_ids.json");
}

interface BookingRequest {
  call_record_id: string;
  practitioner_id?: string;
  practitioner_name: string;
  practitioner_email?: string;
  appointment_time: string;
  phone?: string;
  address?: string;
  practitioner_type?: string;
  summary?: string;
  practice_name?: string;
  products?: string;
  appointment_type?: string;  // demo, follow_up, in_person, other
}

/**
 * Book an appointment with Cal.com v2.
 * v2 derives the end time from the configured event type — we no longer compute it.
 */
async function bookCalComAppointment(data: BookingRequest): Promise<CalBookingResult> {
  const startIso = new Date(data.appointment_time).toISOString();

  const metadata: Record<string, string> = {
    source: "supabase_edge_function",
    call_record_id: data.call_record_id,
  };
  if (data.practitioner_id) metadata.practitioner_id = data.practitioner_id;
  if (data.practice_name) metadata.practice_name = data.practice_name;
  if (data.practitioner_type) metadata.practitioner_type = data.practitioner_type;
  if (data.phone) metadata.practitioner_phone = data.phone;
  if (data.products) metadata.products_interested = data.products;

  const attendee: { name: string; email: string; timeZone: string; phoneNumber?: string } = {
    name: data.practitioner_name || "Unknown",
    email: data.practitioner_email || "noemail@superpatch.com",
    timeZone: BUSINESS_TIMEZONE,
  };
  if (data.phone) attendee.phoneNumber = data.phone;

  const bookingPayload = {
    eventTypeId: CAL_EVENT_TYPE_ID,
    start: startIso,
    attendee,
    metadata,
  };

  console.log("📅 Cal.com v2 booking payload:", {
    eventTypeId: bookingPayload.eventTypeId,
    start: bookingPayload.start,
    attendeeName: bookingPayload.attendee.name,
    attendeeTimeZone: bookingPayload.attendee.timeZone,
    metadataKeys: Object.keys(bookingPayload.metadata ?? {}),
  });

  return await createCalBooking(bookingPayload, {
    apiKey: CAL_API_KEY,
    apiVersion: CAL_API_VERSION,
  });
}

/**
 * Update the call_record with booking information. Reads the existing
 * `notes` first so that we APPEND the Cal.com booking line rather than
 * overwriting prior call-summary content (analyze-call writes
 * conversational context into `notes`, and an earlier version of this
 * function was overwriting it on every booking).
 */
async function updateCallRecord(
  supabase: ReturnType<typeof createClient>,
  callRecordId: string,
  bookingUid: string,
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("call_records")
    .select("notes")
    .eq("id", callRecordId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to read call record before booking write-back: ${readError.message}`);
  }

  const nextNotes = buildNotesUpdate(existing?.notes ?? null, bookingUid);

  const { error } = await supabase
    .from("call_records")
    .update({
      appointment_booked: true,
      booking_id: bookingUid,
      calendar_invite_sent: true,
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", callRecordId);

  if (error) {
    throw new Error(`Failed to update call record: ${error.message}`);
  }
}

/**
 * Create appointment record in the appointments table
 */
async function createAppointmentRecord(
  supabase: ReturnType<typeof createClient>,
  data: BookingRequest,
  booking: CalBookingResult
): Promise<string | null> {
  const scheduledAt = booking.start ?? new Date(data.appointment_time).toISOString();
  const title = `SuperPatch Demo - ${data.practice_name || data.practitioner_name || "Unknown"}`;

  const appointmentData = {
    practitioner_id: data.practitioner_id || null,
    call_record_id: data.call_record_id,
    type: data.appointment_type || 'demo',
    title,
    scheduled_at: scheduledAt,
    duration_minutes: 30,
    status: 'scheduled',
    cal_booking_id: String(booking.id),
    cal_booking_uid: booking.uid,
    calendar_invite_sent: true,
    attendee_name: data.practitioner_name,
    attendee_email: data.practitioner_email || null,
    attendee_phone: data.phone || null,
    location_type: 'in_person',
    location_address: data.address || null,
    notes: data.summary || null,
    products_interested: data.products || null,
  };

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert(appointmentData)
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create appointment record:", error.message);
    return null;
  }

  console.log("✅ Appointment record created:", appointment.id);
  return appointment.id;
}

/**
 * Log booking failure for retry. Appends the failure line to existing notes
 * (analyze-call summary, agent annotations, etc.) instead of overwriting
 * them — a transient Cal.com 5xx must not erase the call summary.
 */
async function logBookingFailure(
  supabase: ReturnType<typeof createClient>,
  callRecordId: string,
  error: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("call_records")
    .select("notes")
    .eq("id", callRecordId)
    .maybeSingle();

  await supabase
    .from("call_records")
    .update({
      notes: appendNoteLine(
        (existing as { notes?: string | null } | null)?.notes,
        `Booking failed: ${error}. Will retry.`,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", callRecordId);
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

  console.log("🗓️ book-appointment edge function called");

  try {
    // Parse request body
    const body: BookingRequest = await req.json();

    console.log("📋 Booking request:", {
      call_record_id: body.call_record_id,
      practitioner_name: body.practitioner_name,
      appointment_time: body.appointment_time,
    });

    // Validate required fields
    if (!body.call_record_id) {
      return new Response(
        JSON.stringify({ error: "call_record_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.appointment_time) {
      return new Response(
        JSON.stringify({ error: "appointment_time is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if booking already exists in call_records (legacy) or appointments table.
    // maybeSingle() returns null + no error when no row exists; .single() throws
    // PGRST116 on zero rows which conflates "no booking yet" with a real DB error.
    const { data: existingRecord } = await supabase
      .from("call_records")
      .select("booking_id")
      .eq("id", body.call_record_id)
      .maybeSingle();

    if (existingRecord?.booking_id) {
      console.log("⏭️ Booking already exists in call_records, skipping");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Booking already exists",
          booking_id: existingRecord.booking_id
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Also check appointments table (same maybeSingle reasoning as above).
    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id, cal_booking_uid")
      .eq("call_record_id", body.call_record_id)
      .maybeSingle();

    if (existingAppointment?.cal_booking_uid) {
      console.log("⏭️ Appointment already exists, skipping");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Appointment already exists",
          appointment_id: existingAppointment.id,
          booking_id: existingAppointment.cal_booking_uid
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Book the appointment via Cal.com v2
    let booking: CalBookingResult;
    try {
      booking = await bookCalComAppointment(body);
    } catch (err) {
      if (err instanceof CalError) {
        console.error("❌ Cal.com booking error:", err.status, err.message);
        try {
          await logBookingFailure(supabase, body.call_record_id, `Cal.com ${err.status}: ${err.message}`);
        } catch {
          // logging failure must not mask the upstream error
        }
        const status = err.status === 409 ? 409 : 502;
        return new Response(
          JSON.stringify({ success: false, error: err.message, status: err.status }),
          {
            status,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          }
        );
      }
      throw err;
    }

    console.log("✅ Cal.com booking created:", {
      id: booking.id,
      uid: booking.uid,
      status: booking.status,
    });

    // Update call record with booking info (for backward compatibility)
    await updateCallRecord(supabase, body.call_record_id, booking.uid);

    console.log("✅ Call record updated with booking info");

    // Create appointment record in the new appointments table. If this fails
    // (returns null) we MUST surface that as a 500 because the Cal.com event
    // is now real but our DB row is missing — webhook-processor needs to see
    // a clear failure so the partial state ends up in call_records.notes for
    // manual reconciliation.
    const appointmentId = await createAppointmentRecord(supabase, body, booking);

    if (appointmentId === null) {
      // Log the partial failure to call_records.notes so operators can find
      // and reconcile the orphaned Cal event from the UI.
      try {
        await logBookingFailure(
          supabase,
          body.call_record_id,
          `Cal booking succeeded (uid=${booking.uid}) but appointments row INSERT failed.`,
        );
      } catch {
        // logging failure must not mask the upstream error
      }
    }

    return buildBookingResponse({ booking, appointmentId });
  } catch (error) {
    console.error("❌ Booking error:", error);

    // Try to log the failure
    try {
      const body = await req.clone().json();
      if (body.call_record_id) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await logBookingFailure(supabase, body.call_record_id, String(error));
      }
    } catch {
      // Ignore logging errors
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        }
      }
    );
  }
});
