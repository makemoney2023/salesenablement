// Canonicalizes the various practitioner-type strings that flow into the
// Edge Functions (Bland.ai pathway variables, Google Maps category strings,
// Supabase practitioners.practitioner_type column values). The canonical
// list mirrors b2b_sales_enablement/bland_ai_pathways/canonical_ids.json
// exactly — adding or removing a canonical type here must be done in
// lockstep with that file and the _shared/pathways.ts mirror.

export type CanonicalPractitionerType =
  | "chiropractor"
  | "massage_therapist"
  | "naturopath"
  | "integrative_medicine"
  | "functional_medicine"
  | "acupuncturist"
  | "unknown";

// Alias keys are stored normalized (lowercase, trimmed, whitespace →
// underscore). The normalizer also strips any trailing _v<number> tag so
// experiment versions collapse to the base canonical type.
const ALIASES: Record<string, CanonicalPractitionerType> = {
  chiropractor: "chiropractor",
  chiropractors: "chiropractor",
  chiro: "chiropractor",

  massage_therapist: "massage_therapist",
  massage_therapists: "massage_therapist",
  massage: "massage_therapist",
  rmt: "massage_therapist",

  naturopath: "naturopath",
  naturopaths: "naturopath",
  naturopathic_doctor: "naturopath",

  integrative_medicine: "integrative_medicine",
  integrative: "integrative_medicine",
  integrative_medicine_doctor: "integrative_medicine",
  integrative_medicine_practitioner: "integrative_medicine",

  functional_medicine: "functional_medicine",
  functional: "functional_medicine",
  functional_medicine_doctor: "functional_medicine",
  functional_medicine_practitioner: "functional_medicine",

  acupuncturist: "acupuncturist",
  acupuncturists: "acupuncturist",
};

const DISPLAY: Record<CanonicalPractitionerType, string> = {
  chiropractor: "Chiropractors",
  massage_therapist: "Massage Therapists",
  naturopath: "Naturopaths",
  integrative_medicine: "Integrative Medicine",
  functional_medicine: "Functional Medicine",
  acupuncturist: "Acupuncturists",
  unknown: "Unknown",
};

const SUMMARIES: Record<CanonicalPractitionerType, string> = {
  chiropractor:
    "Chiropractic practice focused on spinal manipulation, neuromusculoskeletal pain, and rehab protocols. Superpatch positioned as drug-free acute and recovery pain management.",
  massage_therapist:
    "Registered massage therapy practice focused on soft-tissue recovery. Superpatch supports between-session pain management and muscle recovery.",
  naturopath:
    "Naturopathic practice focused on natural, non-invasive solutions. Superpatch positioned as drug-free pain management aligned with naturopathic protocols.",
  integrative_medicine:
    "Integrative-medicine practice combining conventional and alternative approaches. Superpatch as a drug-free adjunct alongside standard pain protocols.",
  functional_medicine:
    "Functional-medicine practice focused on root-cause approaches and integrative wellness. Superpatch positioned as a non-pharmacological tool in a functional protocol.",
  acupuncturist:
    "Acupuncture practice focused on complementary wellness and energy-based healing. Superpatch positioned as a pain-management adjunct between treatments.",
  unknown:
    "Unknown practitioner type — default to chiropractor framing until the practice model is confirmed.",
};

function normalizeKey(raw: string): string {
  return String(raw).toLowerCase().trim().replace(/\s+/g, "_");
}

export function canonicalPractitionerType(
  raw: string | undefined | null,
): CanonicalPractitionerType {
  if (!raw) return "unknown";
  const key = normalizeKey(raw);
  if (ALIASES[key]) return ALIASES[key];
  const stripped = key.replace(/_v\d+$/, "");
  return ALIASES[stripped] ?? "unknown";
}

export function displayName(canonical: CanonicalPractitionerType): string {
  return DISPLAY[canonical];
}

export interface PathwaySummary {
  canonical: CanonicalPractitionerType;
  summary: string;
}

export function pathwaySummaryFor(raw: string | undefined | null): PathwaySummary {
  const canonical = canonicalPractitionerType(raw);
  return { canonical, summary: SUMMARIES[canonical] };
}
