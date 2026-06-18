// Returns the call status. A booking only counts when the prospect actually
// wanted a demo/appointment — an appointment_time alone (callback scheduling)
// must NOT be treated as a booked demo.
export function deriveCallStatus(args: {
  completed: boolean;
  wantsDemo: boolean;
  scheduleDemo: boolean;
  appointmentTime: string | null;
  wentToVoicemail: boolean;
}): "completed" | "booked" | "voicemail" | "failed" {
  if (args.wentToVoicemail) return "voicemail";
  if (!args.completed) return "failed";
  if ((args.wantsDemo || args.scheduleDemo) && args.appointmentTime) return "booked";
  return "completed";
}
