import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { ImportPractitionersSchema, validateBody } from "@/lib/validation";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

// Enrichment data structure (matches hook's EnrichmentData)
interface EnrichmentData {
  practitioners: Array<{ name: string; credentials: string }>;
  emails: string[];
  phones: string[];
  services: string[];
  languages: string[];
  title?: string;
  description?: string;
}

interface SearchResultPractitioner {
  id: string; // Google Place ID
  name: string;
  address: string;
  city: string | null;
  province: string | null;
  country: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  business_status: string;
  google_maps_uri: string | null;
  latitude: number | null;
  longitude: number | null;
  practitioner_type?: string;
  // Pre-enriched data (if enriched before import)
  enrichmentData?: EnrichmentData;
}

interface ImportRequest {
  practitioners: SearchResultPractitioner[];
  enrichAfterImport?: boolean;
  skipAutoEnrich?: boolean; // Skip auto-enrichment (caller will handle separately)
}

interface ImportResponse {
  imported: number;
  duplicates: number;
  errors: string[];
  importedIds: string[];
}

// Normalize phone number for duplicate checking
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, "").slice(-10);
}

// Check if practitioner already exists by Google Place ID or phone
async function checkExisting(
  googlePlaceId: string,
  phone: string | null
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) return null;

  try {
    // Check by Google Place ID first
    const { data: byId } = await supabaseAdmin
      .from("practitioners")
      .select("id")
      .eq("id", googlePlaceId)
      .limit(1)
      .single();

    const typedById = byId as { id: string } | null;
    if (typedById) return typedById.id;

    // Check by phone number
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone) {
        const { data: byPhone } = await supabaseAdmin
          .from("practitioners")
          .select("id")
          .like("phone", `%${normalizedPhone}%`)
          .limit(1);

        const typedByPhone = byPhone as { id: string }[] | null;
        if (typedByPhone && typedByPhone.length > 0) {
          return typedByPhone[0].id;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Auto-enrichment helper — dispatches the enrich-practitioners-v2 Supabase
// Edge Function with a service-role bearer. The previous implementation did a
// server-side fetch to the cookie-protected /api/search/enrich route, which
// had no session and returned 401, so enrichment silently never ran. The Edge
// Function is the canonical enrichment path and owns the Firecrawl logic +
// key, so we hand it the imported IDs and let it batch-enrich.
async function enrichPractitionersAsync(practitionerIds: string[]): Promise<void> {
  if (practitionerIds.length === 0) return;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    console.warn(
      "[Import API] Skipping auto-enrich: Supabase URL or service role key not configured"
    );
    return;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/enrich-practitioners-v2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ practitionerIds }),
      }
    );

    if (response.ok) {
      console.log(
        `[Import API] Auto-enrichment dispatched for ${practitionerIds.length} practitioners`
      );
    } else {
      console.warn(
        `[Import API] Auto-enrichment Edge Function failed: ${response.status}`
      );
    }
  } catch (err) {
    console.error("[Import API] Auto-enrichment error:", err);
  }
}

// POST /api/search/import - Bulk import practitioners from search results
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    // Check Supabase availability
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json(
        {
          imported: 0,
          duplicates: 0,
          errors: ["Database not configured"],
          importedIds: [],
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const validation = validateBody(ImportPractitionersSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          imported: 0,
          duplicates: 0,
          errors: [validation.error],
          importedIds: [],
        },
        { status: 400 }
      );
    }
    const practitioners = validation.data.places as unknown as SearchResultPractitioner[];
    const enrichAfterImport = body.enrichAfterImport;
    const skipAutoEnrich = body.skipAutoEnrich;

    console.log(`[Import API] Processing ${practitioners.length} practitioners`);

    const result: ImportResponse = {
      imported: 0,
      duplicates: 0,
      errors: [],
      importedIds: [],
    };

    // Process each practitioner
    for (const practitioner of practitioners) {
      try {
        // Check if already exists
        const existingId = await checkExisting(practitioner.id, practitioner.phone);
        
        if (existingId) {
          console.log(`[Import API] Duplicate found for ${practitioner.name} (${existingId})`);
          result.duplicates++;
          continue;
        }

        // Build the practitioner record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const record: Record<string, any> = {
          id: practitioner.id, // Use Google Place ID as primary ID
          name: practitioner.name,
          practitioner_type: practitioner.practitioner_type || "Unknown",
          address: practitioner.address || null,
          city: practitioner.city || null,
          province: practitioner.province || null,
          phone: practitioner.phone || null,
          website: practitioner.website || null,
          rating: practitioner.rating || null,
          review_count: practitioner.review_count || null,
          business_status: practitioner.business_status || "OPERATIONAL",
          google_maps_uri: practitioner.google_maps_uri || null,
          latitude: practitioner.latitude || null,
          longitude: practitioner.longitude || null,
          country: practitioner.country || null, // Store country properly
          scraped_at: new Date().toISOString(),
          is_user_added: false,
          do_not_call: false,
          notes: `Imported from Google Maps search`,
        };

        // If enrichment data was provided (pre-enriched), include it
        if (practitioner.enrichmentData) {
          record.enrichment = {
            scraped_at: new Date().toISOString(),
            success: true,
            data: practitioner.enrichmentData,
          };
          record.enrichment_status = "enriched";
          record.enriched_at = new Date().toISOString();
          console.log(`[Import API] Including pre-enriched data for ${practitioner.name}`);
        }

        // Insert into database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
          .from("practitioners")
          .insert(record)
          .select("id")
          .single();

        if (error) {
          // Handle duplicate key error gracefully
          if (error.code === "23505") {
            console.log(`[Import API] Duplicate key for ${practitioner.name}`);
            result.duplicates++;
          } else {
            console.error(`[Import API] Error inserting ${practitioner.name}:`, error.message);
            result.errors.push(`${practitioner.name}: ${error.message}`);
          }
        } else {
          result.imported++;
          result.importedIds.push(data.id);
          console.log(`[Import API] Imported: ${practitioner.name} (${data.id})`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        result.errors.push(`${practitioner.name}: ${errorMessage}`);
      }
    }

    console.log(`[Import API] Complete: ${result.imported} imported, ${result.duplicates} duplicates, ${result.errors.length} errors`);

    // Auto-enrich practitioners that have websites but no pre-enriched data
    // Skip if caller explicitly requests to handle enrichment separately
    if (!skipAutoEnrich) {
      const needsEnrichment = practitioners.filter(
        (p) => p.website && !p.enrichmentData && result.importedIds.includes(p.id)
      );

      if (needsEnrichment.length > 0) {
        console.log(`[Import API] Auto-enriching ${needsEnrichment.length} practitioners with websites`);

        // Fire async enrichment (non-blocking) - don't await
        enrichPractitionersAsync(needsEnrichment.map((p) => p.id)).catch((err) => {
          console.error("[Import API] Async enrichment error:", err);
        });
      }

      // Legacy support for explicit enrichAfterImport flag
      if (enrichAfterImport && result.importedIds.length > 0) {
        console.log(`[Import API] Enrichment flag was set (handled by auto-enrich)`);
      }
    } else {
      console.log(`[Import API] Skipping auto-enrichment (skipAutoEnrich=true)`);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Import API] Error:", error);
    return NextResponse.json(
      {
        imported: 0,
        duplicates: 0,
        errors: ["Failed to import practitioners"],
        importedIds: [],
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/info
export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  return NextResponse.json({
    status: "ok",
    message: "Practitioner Import API",
    configured: isSupabaseConfigured,
    usage: {
      method: "POST",
      body: {
        practitioners: "array of practitioner objects from search results",
        enrichAfterImport: "boolean (optional, trigger Firecrawl enrichment after import)",
      },
    },
  });
}
