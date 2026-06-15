/**
 * Edge Function deploy-config regression test.
 *
 * Asserts that `supabase/config.toml` declares the public-facing,
 * third-party-driven Edge Functions with `verify_jwt = false`. Without this,
 * the Supabase API gateway rejects unauthenticated POSTs at the edge
 * (HTTP 401 / sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER) BEFORE the
 * function code runs — silently dropping every Bland.ai webhook delivery
 * and breaking the entire post-call data pipeline (call_records,
 * sample_requests, appointments, follow_up_queue).
 *
 * Functions in this list defend themselves in-code via HMAC
 * (BLAND_WEBHOOK_SECRET) or method/payload validation, so it is safe
 * — and required — to disable the gateway-level JWT check.
 *
 * If you remove a function from this list, also remove its in-code
 * authentication and document the change in docs/dev/changelog.md.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../..");
const CONFIG_PATH = resolve(
  REPO_ROOT,
  "superpatch-frontend/supabase/config.toml",
);

const PUBLIC_FUNCTIONS_REQUIRING_NO_JWT = ["webhook-processor"] as const;

// Every other function is invoked with a service-role JWT (pg_cron/pg_net or
// our API routes / Edge-to-Edge dispatch) and has no in-code anonymous auth,
// so the gateway must enforce a valid JWT. Pin them explicitly so the default
// can never silently flip and expose them to anonymous POSTs.
const FUNCTIONS_REQUIRING_JWT = [
  "book-appointment",
  "process-retry-queue",
  "send-sample-confirmation",
  "analyze-call",
  "sync-cal-bookings",
  "enrich-practitioners-v2",
  "generate-daily-report",
] as const;

describe("supabase/config.toml — verify_jwt for public Edge Functions", () => {
  it("config.toml exists", () => {
    expect(existsSync(CONFIG_PATH)).toBe(true);
  });

  for (const fn of PUBLIC_FUNCTIONS_REQUIRING_NO_JWT) {
    it(`declares [functions.${fn}] verify_jwt = false`, () => {
      const text = readFileSync(CONFIG_PATH, "utf8");
      const section = new RegExp(
        `\\[functions\\.${fn}\\][\\s\\S]*?verify_jwt\\s*=\\s*false`,
        "m",
      );
      expect(text).toMatch(section);
    });
  }

  for (const fn of FUNCTIONS_REQUIRING_JWT) {
    it(`declares [functions.${fn}] verify_jwt = true`, () => {
      const text = readFileSync(CONFIG_PATH, "utf8");
      const section = new RegExp(
        `\\[functions\\.${fn}\\][\\s\\S]*?verify_jwt\\s*=\\s*true`,
        "m",
      );
      expect(text).toMatch(section);
    });
  }
});
