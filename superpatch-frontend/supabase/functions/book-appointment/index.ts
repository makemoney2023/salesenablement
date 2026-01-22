// Supabase Edge Function for booking Cal.com appointments
// Triggered by database trigger when appointment_booked = true and booking_id is NULL
// @ts-nocheck - Deno types not available in IDE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CAL_API_KEY = Deno.env.get("CAL_API_KEY") || "";
const CAL_EVENT_TYPE_ID = Number(Deno.env.get("CAL_EVENT_TYPE_ID")) || 4352394;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

interface CalComBookingResponse {
  id: number;
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
}

/**
 * Book an appointment with Cal.com
 */
async function bookCalComAppointment(data: BookingRequest): Promise<CalComBookingResponse> {
  if (!CAL_API_KEY) {
    throw new Error("CAL_API_KEY not configured");
  }

  // Parse the start time and calculate end time (30 min later)
  const start = new Date(data.appointment_time);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  // Build notes for sales team with full context
  const notes = [
    `Practice: ${data.practice_name || data.practitioner_name || "N/A"}`,
    `Type: ${data.practitioner_type || "N/A"}`,
    `Phone: ${data.phone || "N/A"}`,
    `Products Interested: ${data.products || "N/A"}`,
    `Address: ${data.address || "TBD"}`,
    "",
    "Call Summary:",
    data.summary || "No summary available",
  ].join("\n");

  const bookingPayload = {
    eventTypeId: CAL_EVENT_TYPE_ID,
    start: start.toISOString(),
    end: end.toISOString(),
    responses: {
      name: data.practitioner_name || "Unknown",
      email: data.practitioner_email || "noemail@superpatch.com",
      location: {
        value: "inPerson",
        optionValue: data.address || "TBD",
      },
    },
    timeZone: "America/New_York",
    language: "en",
    title: `SuperPatch Demo - ${data.practice_name || data.practitioner_name || "Unknown"}`,
    description: notes,
    metadata: {
      source: "supabase_edge_function",
      call_record_id: data.call_record_id,
      practice_name: data.practice_name,
      practitioner_type: data.practitioner_type,
      practitioner_phone: data.phone,
      products_interested: data.products,
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

/**
 * Update call record with booking information
 */
async function updateCallRecord(
  supabase: ReturnType<typeof createClient>,
  callRecordId: string,
  bookingId: string,
  bookingUid: string
): Promise<void> {
  const { error } = await supabase
    .from("call_records")
    .update({
      booking_id: bookingUid,
      calendar_invite_sent: true,
      notes: `Cal.com Booking ID: ${bookingId}, UID: ${bookingUid}`,
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
  booking: CalComBookingResponse
): Promise<string | null> {
  const appointmentData = {
    practitioner_id: data.practitioner_id || null,
    call_record_id: data.call_record_id,
    type: data.appointment_type || 'demo',
    title: booking.title,
    scheduled_at: booking.startTime,
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
 * Log booking failure for retry
 */
async function logBookingFailure(
  supabase: ReturnType<typeof createClient>,
  callRecordId: string,
  error: string
): Promise<void> {
  await supabase
    .from("call_records")
    .update({
      notes: `Booking failed: ${error}. Will retry.`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", callRecordId);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
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

    // Check if booking already exists in call_records (legacy) or appointments table
    const { data: existingRecord } = await supabase
      .from("call_records")
      .select("booking_id")
      .eq("id", body.call_record_id)
      .single();

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

    // Also check appointments table
    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id, cal_booking_uid")
      .eq("call_record_id", body.call_record_id)
      .single();

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

    // Book the appointment
    const booking = await bookCalComAppointment(body);
    
    console.log("✅ Cal.com booking created:", {
      id: booking.id,
      uid: booking.uid,
      status: booking.status,
    });

    // Update call record with booking info (for backward compatibility)
    await updateCallRecord(
      supabase,
      body.call_record_id,
      String(booking.id),
      booking.uid
    );

    console.log("✅ Call record updated with booking info");

    // Create appointment record in the new appointments table
    const appointmentId = await createAppointmentRecord(supabase, body, booking);

    return new Response(
      JSON.stringify({
        success: true,
        booking: {
          id: booking.id,
          uid: booking.uid,
          title: booking.title,
          startTime: booking.startTime,
          status: booking.status,
        },
        appointment_id: appointmentId,
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    );
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
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    );
  }
});
