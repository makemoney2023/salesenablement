// Mirrors src/lib/db/types.ts AppointmentStatus exactly. Do not add new
// values here without also updating the DB-facing union and the UI's
// STATUS_CONFIG in src/app/campaign/appointments/page.tsx.
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";

export function normalizeCalStatus(calStatus: string | undefined | null): AppointmentStatus {
  if (!calStatus) return "scheduled";
  const normalized = String(calStatus).toLowerCase();
  switch (normalized) {
    case "accepted":
    case "confirmed":
      return "confirmed";
    case "pending":
      return "scheduled";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "rescheduled":
      return "rescheduled";
    case "completed":
      return "completed";
    case "no_show":
    case "no-show":
      return "no_show";
    default:
      console.warn(`[normalizeCalStatus] Unknown Cal.com status "${calStatus}"; defaulting to "scheduled"`);
      return "scheduled";
  }
}
