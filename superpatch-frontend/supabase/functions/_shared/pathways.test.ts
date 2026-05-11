/**
 * Deno-side companion of src/__tests__/canonical-ids-sync.test.ts.
 *
 * Vitest already cross-checks canonical_ids.json against this Edge module,
 * but that test runs in the Node toolchain. This test guarantees the
 * Edge runtime sees the same IDs, so an Edge Function deploy that ships
 * stale UUIDs will fail before it leaves CI.
 */
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  DEFAULT_PATHWAY_ID,
  DEFAULT_WEBHOOK_URL,
  KB_ID,
  PATHWAY_IDS,
  VOICE_ID,
  getPathwayId,
} from "./pathways.ts";

interface CanonicalPathway {
  id: string;
  contextual_file: string;
  aliases: string[];
}

interface CanonicalIds {
  pathways: Record<string, CanonicalPathway>;
  default_pathway_key: string;
  knowledge_base: { id: string };
  voice: { id: string };
  webhooks: { primary: string };
}

const canonical: CanonicalIds = JSON.parse(
  await Deno.readTextFile(
    new URL(
      "../../../../b2b_sales_enablement/bland_ai_pathways/canonical_ids.json",
      import.meta.url,
    ),
  ),
);

Deno.test("KB_ID matches canonical knowledge_base.id", () => {
  assertEquals(KB_ID, canonical.knowledge_base.id);
});

Deno.test("VOICE_ID matches canonical voice.id", () => {
  assertEquals(VOICE_ID, canonical.voice.id);
});

Deno.test("DEFAULT_PATHWAY_ID matches canonical default_pathway_key entry", () => {
  const expected = canonical.pathways[canonical.default_pathway_key].id;
  assertEquals(DEFAULT_PATHWAY_ID, expected);
});

Deno.test("DEFAULT_WEBHOOK_URL matches canonical webhooks.primary", () => {
  assertEquals(DEFAULT_WEBHOOK_URL, canonical.webhooks.primary);
});

Deno.test("every canonical pathway id is present in PATHWAY_IDS", () => {
  for (const [key, entry] of Object.entries(canonical.pathways)) {
    // canonical slug itself must resolve
    const slugResolved = PATHWAY_IDS[key] ?? PATHWAY_IDS[key.toLowerCase()];
    assertEquals(
      slugResolved,
      entry.id,
      `Edge PATHWAY_IDS missing canonical slug "${key}" -> ${entry.id}`,
    );
    // every alias must also resolve to the same id
    for (const alias of entry.aliases) {
      const aliasResolved =
        PATHWAY_IDS[alias] ?? PATHWAY_IDS[alias.toLowerCase().trim()];
      if (aliasResolved !== undefined) {
        assertEquals(
          aliasResolved,
          entry.id,
          `Alias "${alias}" resolves to wrong id`,
        );
      }
    }
  }
});

Deno.test("getPathwayId routes every canonical key + alias to the canonical id", () => {
  for (const [key, entry] of Object.entries(canonical.pathways)) {
    assertEquals(getPathwayId(key), entry.id);
    for (const alias of entry.aliases) {
      // getPathwayId lowercases + trims, so aliases with weird casing should still work
      assertEquals(getPathwayId(alias.toUpperCase()), entry.id);
    }
  }
});

Deno.test("getPathwayId returns default for unknown or empty inputs", () => {
  assertEquals(getPathwayId(undefined), DEFAULT_PATHWAY_ID);
  assertEquals(getPathwayId(null), DEFAULT_PATHWAY_ID);
  assertEquals(getPathwayId(""), DEFAULT_PATHWAY_ID);
  assertEquals(getPathwayId("not-a-real-type"), DEFAULT_PATHWAY_ID);
});
