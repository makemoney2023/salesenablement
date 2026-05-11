// Status normalization for Cal.com v2 bookings.
//
// Cal.com v2 returns lowercase statuses (accepted, cancelled, rescheduled,
// pending, completed). This module maps them onto the AppointmentStatus enum
// used by the `appointments` table.

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "completed"
  | "no_show";

export function normalizeCalStatus(calStatus: string | undefined | null): AppointmentStatus {
  if (!calStatus) return "pending";
  switch (String(calStatus).toLowerCase()) {
    case "accepted":
    case "confirmed":
      return "confirmed";
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
      return "pending";
  }
}
