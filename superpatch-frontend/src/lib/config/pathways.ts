/**
 * Shared Bland.ai pathway configuration (frontend mirror).
 *
 * The CANONICAL source of truth is:
 *   b2b_sales_enablement/bland_ai_pathways/canonical_ids.json
 *
 * This module mirrors those IDs for frontend consumption. The Edge Function
 * mirror lives at supabase/functions/_shared/pathways.ts. A Vitest test
 * (src/__tests__/canonical-ids-sync.test.ts) asserts all three stay in sync.
 *
 * If an ID changes: (1) update canonical_ids.json, (2) update this file,
 * (3) update supabase/functions/_shared/pathways.ts, (4) run `pnpm test`.
 */

// Pathway IDs for different practitioner types
export const PATHWAY_IDS: Record<string, string> = {
  chiropractor: "9aa760af-6f9a-430f-8d0c-25bf84afd8fb",
  chiropractors: "9aa760af-6f9a-430f-8d0c-25bf84afd8fb",
  massage: "1fee31b1-8179-48c6-b6fa-12fcd434ed2b",
  "massage therapist": "1fee31b1-8179-48c6-b6fa-12fcd434ed2b",
  massage_therapist: "1fee31b1-8179-48c6-b6fa-12fcd434ed2b",
  rmt: "1fee31b1-8179-48c6-b6fa-12fcd434ed2b",
  naturopath: "db955b59-d278-410e-981e-5728dfa2dafd",
  naturopaths: "db955b59-d278-410e-981e-5728dfa2dafd",
  "naturopathic doctor": "db955b59-d278-410e-981e-5728dfa2dafd",
  integrative: "b6240419-3b24-4415-9541-804994cce425",
  integrative_medicine: "b6240419-3b24-4415-9541-804994cce425",
  "integrative medicine": "b6240419-3b24-4415-9541-804994cce425",
  "integrative medicine doctor": "b6240419-3b24-4415-9541-804994cce425",
  "integrative medicine practitioner": "b6240419-3b24-4415-9541-804994cce425",
  functional: "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  functional_medicine: "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  "functional medicine": "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  "functional medicine doctor": "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  "functional medicine practitioner": "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  acupuncturist: "084673ec-84d6-4c3a-bedb-ba9d72bd7e3b",
  acupuncturists: "084673ec-84d6-4c3a-bedb-ba9d72bd7e3b",
};

// Short-form mapping for UI dropdowns in quick call
export const PATHWAY_IDS_SHORT: Record<string, string> = {
  chiropractor: PATHWAY_IDS.chiropractor,
  massage: PATHWAY_IDS.massage,
  naturopath: PATHWAY_IDS.naturopath,
  integrative: PATHWAY_IDS.integrative,
  functional: PATHWAY_IDS.functional,
  acupuncturist: PATHWAY_IDS.acupuncturist,
};

export const DEFAULT_PATHWAY_ID = PATHWAY_IDS.chiropractor;

export const KB_ID = "b671527d-0c2d-4a21-9586-033dad3b0255";
export const VOICE_ID = "78c8543e-e5fe-448e-8292-20a7b8c45247";

/**
 * Bland.ai webhook URL for call completion callbacks.
 * Uses Supabase Edge Function for lower latency, same infrastructure as database.
 * Falls back to hardcoded URL if env var is not set.
 */
export const WEBHOOK_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BLAND_WEBHOOK_URL) ||
  "https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor";

/**
 * Resolve a practitioner type string to its pathway ID.
 * Falls back to the default (chiropractor) pathway.
 */
export function getPathwayId(practitionerType: string): string {
  const typeKey = practitionerType.toLowerCase().trim();
  return PATHWAY_IDS[typeKey] || DEFAULT_PATHWAY_ID;
}
