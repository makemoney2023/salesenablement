// Classifies the inbound products_interested / sample_products string
// into the two sample_type values our DB enforces.
//
// Previously the classifier was inline as:
//   sample_type: productsRaw === "all" || !productsRaw ? "standard_kit" : "custom"
// which failed for the explicit literal "standard_kit" — Bland.ai pathways
// that send products_interested="standard_kit" were being classified as
// "custom" and the row's products_requested column was being populated
// with [`standard_kit`] instead of NULL.

export type SampleType = "standard_kit" | "custom";

export function classifySampleType(raw: string | null | undefined): SampleType {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return "standard_kit";
  if (value === "all") return "standard_kit";
  if (value === "standard_kit") return "standard_kit";
  if (value === "standard kit") return "standard_kit";
  return "custom";
}

/**
 * Returns the products_requested array we want to persist alongside
 * sample_type. For a standard_kit classification we explicitly write
 * null so the column doesn't pick up the marker token itself.
 */
export function buildProductsRequested(
  raw: string | null | undefined,
  sampleType: SampleType,
): string[] | null {
  if (sampleType === "standard_kit") return null;
  if (!raw) return null;
  const products = String(raw)
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return products.length > 0 ? products : null;
}
