/**
 * Shared Bland.ai pathway configuration for Supabase Edge Functions.
 *
 * This file mirrors the IDs in:
 *   - b2b_sales_enablement/bland_ai_pathways/canonical_ids.json (source of truth)
 *   - superpatch-frontend/src/lib/config/pathways.ts (frontend mirror)
 *
 * A Vitest test (src/__tests__/canonical-ids-sync.test.ts) enforces that all
 * three stay in sync. If you change an ID here, update the JSON and frontend
 * module, then run `pnpm test` from superpatch-frontend/.
 *
 * Edge Functions (Deno) import from this file with a relative path, e.g.
 *   import { PATHWAY_IDS, KB_ID, VOICE_ID, getPathwayId } from "../_shared/pathways.ts";
 */

export const PATHWAY_IDS: Record<string, string> = {
  chiropractor: "9aa760af-6f9a-430f-8d0c-25bf84afd8fb",
  chiropractors: "9aa760af-6f9a-430f-8d0c-25bf84afd8fb",
  massage: "1fee31b1-8179-48c6-b6fa-12fcd434ed2b",
  "massage therapist": "1fee31b1-8179-48c6-b6fa-12fcd434ed2b",
  massage_therapist: "1fee31b1-8179-48c6-b6fa-12fcd434ed2b",
  rmt: "1fee31b1-8179-48c6-b6fa-12fcd434ed2b",
  naturopath: "db955b59-d278-410e-981e-5728dfa2dafd",
  "naturopathic doctor": "db955b59-d278-410e-981e-5728dfa2dafd",
  integrative: "b6240419-3b24-4415-9541-804994cce425",
  "integrative medicine": "b6240419-3b24-4415-9541-804994cce425",
  "integrative medicine doctor": "b6240419-3b24-4415-9541-804994cce425",
  "integrative medicine practitioner": "b6240419-3b24-4415-9541-804994cce425",
  functional: "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  "functional medicine": "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  "functional medicine doctor": "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  "functional medicine practitioner": "70f3a50a-9055-4f41-bc0d-81964dfae19a",
  acupuncturist: "084673ec-84d6-4c3a-bedb-ba9d72bd7e3b",
};

export const DEFAULT_PATHWAY_ID = PATHWAY_IDS.chiropractor;

export const KB_ID = "b671527d-0c2d-4a21-9586-033dad3b0255";
export const VOICE_ID = "78c8543e-e5fe-448e-8292-20a7b8c45247";

export const DEFAULT_WEBHOOK_URL =
  "https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor";

export function getPathwayId(practitionerType: string | null | undefined): string {
  if (!practitionerType) return DEFAULT_PATHWAY_ID;
  const typeKey = practitionerType.toLowerCase().trim();
  return PATHWAY_IDS[typeKey] || DEFAULT_PATHWAY_ID;
}
