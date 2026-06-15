/**
 * RLS posture regression test.
 *
 * Asserts that the row-level-security policies on every PII / sensitive
 * table use `public.is_active_user()` as their predicate, NOT the looser
 * `auth.uid() IS NOT NULL`.
 *
 * Why this matters: a leaked JWT for any signed-up user (or a "deactivated"
 * user whose JWT has not yet expired) cannot be allowed to read or mutate
 * the entire corpus of practitioners / transcripts / appointments. Tying
 * RLS to `user_profiles.is_active = true` adds a hard revocation point —
 * flipping is_active=false in user_profiles immediately removes access.
 *
 * This test pins the textual shape of the latest RLS migration so a
 * future migration that accidentally re-introduces the looser predicate
 * is caught in CI before it ships.
 *
 * For live behavior verification, see the `Verification` section of
 * docs/dev/changelog.md for the 2026-05-14 RLS-tightening entry (anon
 * key + non-active profile -> empty result via PostgREST).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../..");
const MIGRATIONS_DIR = resolve(
  REPO_ROOT,
  "superpatch-frontend/supabase/migrations",
);
const RLS_MIGRATION = "20260514_tighten_rls_to_active_profiles.sql";
const RLS_MIGRATION_PATH = resolve(MIGRATIONS_DIR, RLS_MIGRATION);

const PROTECTED_TABLES = [
  "call_records",
  "call_notes",
  "campaign_analytics",
  "practitioners",
  "sample_requests",
  "appointments",
  "follow_up_queue",
  "pathway_suggestions",
] as const;

describe("RLS migration — tighten to is_active_user()", () => {
  it("migration file exists", () => {
    expect(existsSync(RLS_MIGRATION_PATH)).toBe(true);
  });

  it("defines is_active_user() helper as SECURITY DEFINER", () => {
    const text = readFileSync(RLS_MIGRATION_PATH, "utf8");
    expect(text).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.is_active_user\(\)[\s\S]*?SECURITY DEFINER/,
    );
    // The function MUST gate on user_profiles.is_active = true. A future
    // refactor that drops the is_active check would silently regress the
    // policy from "active users" back to "anyone with a profile row".
    expect(text).toMatch(/is_active\s*=\s*TRUE/);
  });

  for (const table of PROTECTED_TABLES) {
    it(`${table}: all four CRUD policies use public.is_active_user()`, () => {
      const text = readFileSync(RLS_MIGRATION_PATH, "utf8");
      // Each table must have SELECT / INSERT / UPDATE / DELETE policies
      // (campaign_analytics is the one exception — no DELETE policy was
      // ever defined; the prior migration explicitly omitted it).
      const verbs =
        table === "campaign_analytics"
          ? (["SELECT", "INSERT", "UPDATE"] as const)
          : (["SELECT", "INSERT", "UPDATE", "DELETE"] as const);

      for (const verb of verbs) {
        const policyPattern = new RegExp(
          `CREATE POLICY[\\s\\S]*?ON public\\.${table}\\s+FOR ${verb}[\\s\\S]*?public\\.is_active_user\\(\\)`,
          "m",
        );
        expect(text).toMatch(policyPattern);
      }
    });

    it(`${table}: drops the prior auth.uid() IS NOT NULL policies`, () => {
      const text = readFileSync(RLS_MIGRATION_PATH, "utf8");
      // The migration must explicitly DROP the prior loose policies; if
      // it doesn't, both the old and new policies exist, and PostgreSQL
      // ORs them — so the loose policy still grants access.
      const dropPattern = new RegExp(
        `DROP POLICY IF EXISTS[\\s\\S]*?ON public\\.${table}`,
      );
      expect(text).toMatch(dropPattern);
    });
  }

  it("does NOT contain a CREATE POLICY that uses the looser auth.uid() IS NOT NULL predicate", () => {
    const text = readFileSync(RLS_MIGRATION_PATH, "utf8");
    // Belt-and-braces: a CREATE POLICY line that gates on
    // `auth.uid() IS NOT NULL` would silently re-introduce the gap this
    // migration is designed to close.
    const createPolicyBlocks = text.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
    for (const block of createPolicyBlocks) {
      expect(block).not.toMatch(/auth\.uid\(\)\s+IS\s+NOT\s+NULL/);
    }
  });

  it("calls NOTIFY pgrst so PostgREST picks up the new policies immediately", () => {
    const text = readFileSync(RLS_MIGRATION_PATH, "utf8");
    expect(text).toMatch(/NOTIFY pgrst,\s*'reload schema'/);
  });

  it("is the latest RLS migration (no later file weakens these policies)", () => {
    // If someone adds a NEW migration with a later date that contains a
    // CREATE POLICY using `auth.uid() IS NOT NULL`, this test fails so
    // we don't silently regress.
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const rlsIdx = files.indexOf(RLS_MIGRATION);
    expect(rlsIdx).toBeGreaterThanOrEqual(0);
    const later = files.slice(rlsIdx + 1);
    for (const f of later) {
      const body = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
      const createPolicies = body.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
      for (const block of createPolicies) {
        // It's fine for a later migration to add tenant-scoped or admin
        // policies; what's NOT fine is re-introducing the loose
        // any-authenticated-user predicate on the protected tables.
        const touchesProtected = PROTECTED_TABLES.some((t) =>
          new RegExp(`ON\\s+(public\\.)?${t}\\b`).test(block),
        );
        if (touchesProtected) {
          expect(block).not.toMatch(/auth\.uid\(\)\s+IS\s+NOT\s+NULL/);
        }
      }
    }
  });
});
