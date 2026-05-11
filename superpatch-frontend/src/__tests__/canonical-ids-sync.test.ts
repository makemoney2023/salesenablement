/**
 * Canonical IDs sync test.
 *
 * Asserts that pathway/KB/voice IDs stay in sync across three places:
 *   1. b2b_sales_enablement/bland_ai_pathways/canonical_ids.json (source of truth)
 *   2. superpatch-frontend/src/lib/config/pathways.ts (frontend mirror)
 *   3. superpatch-frontend/supabase/functions/_shared/pathways.ts (Edge mirror)
 *
 * The Edge function file is validated by text parsing because tsconfig excludes
 * supabase/functions from the Next.js build.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  PATHWAY_IDS,
  DEFAULT_PATHWAY_ID,
  KB_ID,
  VOICE_ID,
} from "@/lib/config/pathways";

const REPO_ROOT = resolve(__dirname, "../../..");
const CANONICAL_PATH = resolve(
  REPO_ROOT,
  "b2b_sales_enablement/bland_ai_pathways/canonical_ids.json"
);
const EDGE_SHARED_PATH = resolve(
  __dirname,
  "../../supabase/functions/_shared/pathways.ts"
);

interface CanonicalIds {
  pathways: Record<
    string,
    { id: string; contextual_file: string; aliases: string[] }
  >;
  default_pathway_key: string;
  knowledge_base: { id: string };
  voice: { id: string };
  tools: Record<string, { id: string }>;
}

function loadCanonical(): CanonicalIds {
  if (!existsSync(CANONICAL_PATH)) {
    throw new Error(
      `canonical_ids.json not found at ${CANONICAL_PATH}. This file is the source of truth for Bland.ai IDs.`
    );
  }
  return JSON.parse(readFileSync(CANONICAL_PATH, "utf-8")) as CanonicalIds;
}

describe("Canonical IDs sync", () => {
  const canonical = loadCanonical();

  describe("frontend pathways.ts matches canonical_ids.json", () => {
    it("KB_ID matches", () => {
      expect(KB_ID).toBe(canonical.knowledge_base.id);
    });

    it("VOICE_ID matches", () => {
      expect(VOICE_ID).toBe(canonical.voice.id);
    });

    it("DEFAULT_PATHWAY_ID matches the canonical default", () => {
      const defaultKey = canonical.default_pathway_key;
      expect(DEFAULT_PATHWAY_ID).toBe(canonical.pathways[defaultKey].id);
    });

    it.each(Object.entries({
      chiropractor: "chiropractor",
      massage_therapist: "massage_therapist",
      naturopath: "naturopath",
      integrative_medicine: "integrative_medicine",
      functional_medicine: "functional_medicine",
      acupuncturist: "acupuncturist",
    }))("canonical pathway %s resolves to the same id in PATHWAY_IDS", (key) => {
      const canonicalEntry = canonical.pathways[key];
      expect(canonicalEntry, `canonical_ids.json missing pathway key: ${key}`).toBeDefined();
      // For each alias + canonical slug, frontend must resolve to the same ID
      const allKeys = [key, ...canonicalEntry.aliases];
      for (const alias of allKeys) {
        const frontendValue =
          PATHWAY_IDS[alias] ?? PATHWAY_IDS[alias.toLowerCase().trim()];
        if (frontendValue !== undefined) {
          expect(frontendValue).toBe(canonicalEntry.id);
        }
      }
    });
  });

  describe("Edge Function _shared/pathways.ts matches canonical_ids.json", () => {
    const edgeContent = existsSync(EDGE_SHARED_PATH)
      ? readFileSync(EDGE_SHARED_PATH, "utf-8")
      : null;

    it("file exists", () => {
      expect(edgeContent, `Edge shared pathways file missing at ${EDGE_SHARED_PATH}`).not.toBeNull();
    });

    it("contains every canonical pathway ID", () => {
      if (!edgeContent) return;
      for (const [key, entry] of Object.entries(canonical.pathways)) {
        expect(
          edgeContent.includes(entry.id),
          `Edge _shared/pathways.ts missing ${key} pathway id ${entry.id}`
        ).toBe(true);
      }
    });

    it("contains canonical KB and voice IDs", () => {
      if (!edgeContent) return;
      expect(edgeContent).toContain(canonical.knowledge_base.id);
      expect(edgeContent).toContain(canonical.voice.id);
    });
  });
});
