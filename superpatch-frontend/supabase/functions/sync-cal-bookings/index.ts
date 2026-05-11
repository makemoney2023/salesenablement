// Supabase Edge Function for syncing Cal.com bookings.
// Triggered by pg_cron every 15 minutes to sync booking status.
// Uses Cal.com v2 (v1 was retired 2026-04-08).
// @ts-nocheck - Deno types not available in IDE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CalError, listCalBookings, type CalBookingResult } from "../_shared/cal.ts";
import { appendNoteLine } from "../_shared/notes.ts";
import { normalizeCalStatus } from "./status.ts";

const CAL_API_KEY = Deno.env.get("CAL_API_KEY") ?? "";
const CAL_API_VERSION = Deno.env.get("CAL_API_VERSION"); // helper applies default when undefined
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!CAL_API_KEY) throw new Error("sync-cal-bookings: CAL_API_KEY is required");

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  cancelled: number;
  errors: string[];
}

/**
 * Sync a single booking to the appointments table.
 */
async function syncToAppointmentsTable(
  supabase: ReturnType<typeof createClient>,
  booking: CalBookingResult,
): Promise<{ synced: boolean; error?: string }> {
  try {
    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id, status, scheduled_at")
      .eq("cal_booking_uid", booking.uid)
      .single();

    if (!existingAppointment) {
      return { synced: false };
    }

    const appointmentUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const newStatus = normalizeCalStatus(booking.status);

    if (existingAppointment.status !== newStatus) {
      appointmentUpdates.status = newStatus;

      if (newStatus === "cancelled") {
        appointmentUpdates.cancelled_at = new Date().toISOString();
        appointmentUpdates.cancellation_reason = booking.updatedAt
          ? `Cancelled via Cal.com at ${booking.updatedAt}`
          : `Cancelled via Cal.com (timestamp not provided; observed during sync at ${new Date().toISOString()})`;
      }
    }

    const startDate = booking.start ? new Date(booking.start) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      return { synced: false, error: "Invalid or missing booking.start" };
    }
    const bookingTime = startDate.toISOString();
    const existingTime = existingAppointment.scheduled_at
      ? new Date(existingAppointment.scheduled_at).toISOString()
      : null;

    if (existingTime !== bookingTime) {
      appointmentUpdates.scheduled_at = bookingTime;
      // Time-changed heuristic: Cal v2 sometimes returns "accepted" for a moved
      // booking instead of "rescheduled". Override unless already cancelled.
      if (newStatus !== "cancelled" && existingTime) {
        appointmentUpdates.status = "rescheduled";
      }
      console.log(`📅 Appointment ${existingAppointment.id} rescheduled: ${existingTime} -> ${bookingTime}`);
    }

    const { error } = await supabase
      .from("appointments")
      .update(appointmentUpdates)
      .eq("id", existingAppointment.id);

    if (error) {
      return { synced: false, error: error.message };
    }

    return { synced: true };
  } catch (error) {
    return {
      synced: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync a single booking to Supabase (both call_records and appointments tables).
 */
async function syncBooking(
  supabase: ReturnType<typeof createClient>,
  booking: CalBookingResult,
): Promise<{ action: "created" | "updated" | "cancelled" | "skipped"; error?: string }> {
  try {
    const appointmentResult = await syncToAppointmentsTable(supabase, booking);
    if (appointmentResult.error) {
      console.warn(`⚠️ Failed to sync to appointments table: ${appointmentResult.error}`);
    } else if (appointmentResult.synced) {
      console.log(`✅ Synced booking ${booking.uid} to appointments table`);
    }

    // Bridge to legacy call_records table. We pull `notes` so the
    // cancellation path can append (not overwrite) the cancel marker.
    const { data: existingByBookingId } = await supabase
      .from("call_records")
      .select("id, status, appointment_time, notes")
      .eq("booking_id", booking.uid)
      .single();

    let existingByMetadata = null;
    const metadataCallRecordId = typeof booking.metadata?.call_record_id === "string"
      ? booking.metadata.call_record_id
      : undefined;
    if (metadataCallRecordId) {
      const { data } = await supabase
        .from("call_records")
        .select("id, status, appointment_time, booking_id, notes")
        .eq("id", metadataCallRecordId)
        .single();
      existingByMetadata = data;
    }

    const existing = existingByBookingId || existingByMetadata;

    if (!existing) {
      if (appointmentResult.synced) {
        return { action: "updated" };
      }
      console.log(`⏭️ Booking ${booking.uid} not linked to any call record, skipping`);
      return { action: "skipped" };
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (!existingByBookingId && existingByMetadata && !existingByMetadata.booking_id) {
      updates.booking_id = booking.uid;
    }

    if (normalizeCalStatus(booking.status) === "cancelled") {
      updates.appointment_booked = false;
      // Append the cancel marker via appendNoteLine so the analyze-call
      // summary and the prior `Cal.com Booking ID: ...` line written by
      // book-appointment are preserved across sync cycles.
      const cancelLine = booking.updatedAt
        ? `Appointment cancelled on Cal.com at ${booking.updatedAt}`
        : `Appointment cancelled on Cal.com (timestamp not provided; observed during sync at ${new Date().toISOString()})`;
      updates.notes = appendNoteLine(
        (existing as { notes?: string | null }).notes,
        cancelLine,
      );

      const { error } = await supabase
        .from("call_records")
        .update(updates)
        .eq("id", existing.id);

      if (error) {
        return { action: "cancelled", error: error.message };
      }

      console.log(`🚫 Booking ${booking.uid} marked as cancelled`);
      return { action: "cancelled" };
    }

    const startDate = booking.start ? new Date(booking.start) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      return { action: "skipped", error: "Invalid or missing booking.start" };
    }
    const bookingTime = startDate.toISOString();
    const existingTime = existing.appointment_time
      ? new Date(existing.appointment_time).toISOString()
      : null;

    if (existingTime !== bookingTime) {
      updates.appointment_time = bookingTime;
      console.log(`📅 Booking ${booking.uid} time updated: ${existingTime} -> ${bookingTime}`);
    }

    updates.appointment_booked = true;
    updates.calendar_invite_sent = true;

    const { error } = await supabase
      .from("call_records")
      .update(updates)
      .eq("id", existing.id);

    if (error) {
      return { action: "updated", error: error.message };
    }

    return { action: "updated" };
  } catch (error) {
    return {
      action: "skipped",
      error: error instanceof Error ? error.message : "Unknown error",
    };
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (!verifyServiceAuth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  console.log("🔄 sync-cal-bookings edge function called");

  try {
    let afterDate: string | undefined;
    let beforeDate: string | undefined;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        afterDate = body.after_date;
        beforeDate = body.before_date;
      } catch {
        // No body or invalid JSON — fall through to defaults.
      }
    }

    if (!afterDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      afterDate = yesterday.toISOString();
    }

    if (!beforeDate) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      beforeDate = nextWeek.toISOString();
    }

    console.log(`📅 Syncing bookings from ${afterDate} to ${beforeDate}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { bookings } = await listCalBookings(
      { afterStart: afterDate, beforeStart: beforeDate, take: 250 },
      { apiKey: CAL_API_KEY, apiVersion: CAL_API_VERSION },
    );

    console.log(`📋 Found ${bookings.length} bookings to sync`);

    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      cancelled: 0,
      errors: [],
    };

    for (const booking of bookings) {
      const syncResult = await syncBooking(supabase, booking);

      if (syncResult.error) {
        result.errors.push(`${booking.uid}: ${syncResult.error}`);
      }

      switch (syncResult.action) {
        case "created":
          result.created++;
          result.synced++;
          break;
        case "updated":
          result.updated++;
          result.synced++;
          break;
        case "cancelled":
          result.cancelled++;
          result.synced++;
          break;
      }
    }

    console.log("✅ Sync complete:", result);

    return new Response(
      JSON.stringify({
        success: true,
        total_bookings: bookings.length,
        ...result,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("❌ Sync error:", error);

    const status = error instanceof CalError ? error.status : 500;
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: status >= 400 && status < 600 ? status : 500,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      },
    );
  }
});
