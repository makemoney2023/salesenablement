import { describe, it, expect } from "vitest";
import { deriveCallStatus } from "../_shared/derive-call-status.ts";

describe("deriveCallStatus", () => {
  it("callback with appointment_time but no demo intent is NOT booked", () => {
    expect(deriveCallStatus({
      completed: true, wantsDemo: false, scheduleDemo: false,
      appointmentTime: "2026-06-20T15:00:00Z", wentToVoicemail: false,
    })).toBe("completed");
  });
  it("demo intent + time is booked", () => {
    expect(deriveCallStatus({
      completed: true, wantsDemo: true, scheduleDemo: false,
      appointmentTime: "2026-06-20T15:00:00Z", wentToVoicemail: false,
    })).toBe("booked");
  });
  it("voicemail wins", () => {
    expect(deriveCallStatus({
      completed: true, wantsDemo: true, scheduleDemo: true,
      appointmentTime: "2026-06-20T15:00:00Z", wentToVoicemail: true,
    })).toBe("voicemail");
  });
  it("not completed is failed", () => {
    expect(deriveCallStatus({
      completed: false, wantsDemo: true, scheduleDemo: true,
      appointmentTime: "2026-06-20T15:00:00Z", wentToVoicemail: false,
    })).toBe("failed");
  });
});
