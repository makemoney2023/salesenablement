// Response builder for the book-appointment Edge Function.
//
// The Cal.com booking can succeed (real event lands on the rep's calendar)
// while the appointments-table INSERT separately fails (Supabase 5xx, schema
// drift, etc.). The previous code returned HTTP 200 with `appointment_id:null`
// and `success: true` in that partial-failure case, which made the caller
// (webhook-processor) treat it as success while the UI never saw the row.
//
// New contract:
//   - Both Cal + DB succeed  -> 200 { success: true, appointment_id, booking }
//   - DB row missing         -> 500 { success: false, error, booking }
//
// The Cal-side detail is preserved on both paths so ops can find the calendar
// event when the DB row is missing and reconcile manually.

const ALLOWED_ORIGIN = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } })
  .Deno?.env.get("ALLOWED_ORIGIN") || "*";

const HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

export interface BuildBookingResponseInput {
  booking: {
    id: number | string;
    uid: string;
    status: string;
    start: string;
    end: string;
  };
  appointmentId: string | null;
}

export function buildBookingResponse(input: BuildBookingResponseInput): Response {
  const bookingPayload = {
    id: input.booking.id,
    uid: input.booking.uid,
    status: input.booking.status,
    start: input.booking.start,
    end: input.booking.end,
  };

  if (input.appointmentId === null || input.appointmentId === undefined) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Cal.com booking succeeded but appointment row insert failed. Manual reconciliation required.",
        booking: bookingPayload,
        appointment_id: null,
      }),
      { status: 500, headers: HEADERS },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      booking: bookingPayload,
      appointment_id: input.appointmentId,
    }),
    { status: 200, headers: HEADERS },
  );
}
