import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HOOKS = [
  "useRealtimeCallStatus.ts",
  "useRealtimeRetryQueue.ts",
  "useRealtimePractitioners.ts",
  "useAppointments.ts",
  "useFollowUpQueue.ts",
  "usePathwaySuggestions.ts",
  "useSidebarBadges.ts",
  "useDailyReports.ts",
  "useSampleRequests.ts",
  "useSupabaseCallRecords.ts",
];

describe("call-center read hooks use the session-aware browser client", () => {
  for (const file of HOOKS) {
    it(`${file} imports getBrowserSupabase and not the anon singleton`, () => {
      const src = readFileSync(resolve(__dirname, "../hooks", file), "utf8");
      expect(src).toContain("@/lib/supabase/browser");
      expect(src).not.toMatch(/import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*["']@\/lib\/supabase["']/);
    });
  }
});
