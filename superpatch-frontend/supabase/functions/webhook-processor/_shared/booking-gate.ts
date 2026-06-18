// Decide whether a post-call Cal.com booking must be dispatched. If the in-call
// Bland tool already returned a booking uid (or a booking_id is already saved),
// the post-call booking is skipped to avoid duplicate bookings.
export function needsPostCallBooking(args: {
  inCallBookingUid: string | null;
  existingBookingId: string | null;
}): boolean {
  return !args.inCallBookingUid && !args.existingBookingId;
}
