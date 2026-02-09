// Supabase Edge Function for parallel practitioner enrichment
// Uses Firecrawl to scrape websites and extract practitioner data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Batch size for concurrent Firecrawl calls (your plan supports 50)
const BATCH_SIZE = 50;

// Practitioner credential patterns for extraction
const CREDENTIALS = [
  "DC", "RMT", "ND", "LAc", "R.Ac", "RAc", "PhD", "MD", "DO",
  "PT", "DPT", "OT", "RN", "NP", "PA", "LMT", "CMT", "DOMP",
  "BSc", "MSc", "BScN", "MScN", "CFMP", "DACM", "DOM", "Dipl.Ac",
];

// Email exclusion patterns
const EMAIL_EXCLUSIONS = [
  "example.com", "wordpress", "gravatar", "wix", "squarespace",
  "sentry", "cloudflare", "google", "facebook", "twitter",
  "instagram", "linkedin", "youtube", "noreply", "no-reply",
  "support@", "webmaster", "admin@wordpress",
];

// Service keywords to extract
const SERVICE_KEYWORDS = [
  "chiropractic", "massage therapy", "acupuncture", "naturopathy",
  "physiotherapy", "physical therapy", "osteopathy", "cupping",
  "dry needling", "spinal decompression", "laser therapy",
  "shockwave therapy", "athletic therapy", "sports massage",
  "deep tissue", "prenatal massage", "pediatric", "orthotics",
  "nutrition", "herbal medicine", "homeopathy", "iv therapy",
  "functional medicine", "integrative medicine", "wellness",
  "rehabilitation", "manual therapy", "adjustments",
];

// Language keywords
const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  "English": ["english", "anglais"],
  "French": ["french", "français", "francais", "francophone"],
  "Mandarin": ["mandarin", "chinese", "中文", "普通话"],
  "Cantonese": ["cantonese", "广东话", "粵語"],
  "Spanish": ["spanish", "español", "espanol"],
  "Punjabi": ["punjabi", "ਪੰਜਾਬੀ"],
  "Hindi": ["hindi", "हिन्दी"],
  "Tagalog": ["tagalog", "filipino"],
  "Arabic": ["arabic", "العربية"],
  "Portuguese": ["portuguese", "português"],
  "Korean": ["korean", "한국어"],
  "Vietnamese": ["vietnamese", "tiếng việt"],
  "Italian": ["italian", "italiano"],
  "German": ["german", "deutsch"],
};

interface Practitioner {
  id: string;
  name: string;
  website: string;
}

/**
 * Validates a URL is safe for external fetching (prevents SSRF).
 */
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "[::1]") return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname)) return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    return true;
  } catch {
    return false;
  }
}

interface ExtractedPractitioner {
  name: string;
  credentials: string;
  context?: string;
}

interface EnrichmentData {
  url: string;
  title: string;
  description: string;
  practitioners: ExtractedPractitioner[];
  emails: string[];
  phones: string[];
  services: string[];
  languages: string[];
  raw_text_preview: string;
}

interface EnrichmentResult {
  practitionerId: string;
  name: string;
  success: boolean;
  error?: string;
}

// Extract practitioners from content
function extractPractitioners(content: string): ExtractedPractitioner[] {
  const practitioners: ExtractedPractitioner[] = [];
  const seenNames = new Set<string>();
  const lines = content.split("\n");

  for (const line of lines) {
    if (line.length < 5 || line.length > 500) continue;

    // Look for credential patterns
    for (const cred of CREDENTIALS) {
      if (line.includes(cred)) {
        const pattern = new RegExp(
          `([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?(?:\\s+[A-Z][a-z]+)?)\\s*[,\\-–]\\s*.*${cred.replace(".", "\\.")}`,
          "g"
        );
        const matches = line.matchAll(pattern);

        for (const match of matches) {
          const name = match[1].trim();
          if (name && !seenNames.has(name) && name.length > 3) {
            const falsePositives = ["click", "read", "more", "view", "our", "the", "and"];
            if (!falsePositives.some((fp) => name.toLowerCase().includes(fp))) {
              seenNames.add(name);
              practitioners.push({
                name,
                credentials: cred,
                context: line.slice(0, 200),
              });
            }
          }
        }
      }
    }

    // Look for "Dr." pattern
    const drPattern = /Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
    const drMatches = line.matchAll(drPattern);
    for (const match of drMatches) {
      const name = `Dr. ${match[1].trim()}`;
      if (!seenNames.has(name)) {
        seenNames.add(name);
        practitioners.push({
          name,
          credentials: "Dr.",
          context: line.slice(0, 200),
        });
      }
    }
  }

  return practitioners.slice(0, 10);
}

// Extract emails from content
function extractEmails(content: string): string[] {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = content.match(emailPattern) || [];
  const filtered = emails.filter(
    (e) => !EMAIL_EXCLUSIONS.some((excl) => e.toLowerCase().includes(excl))
  );
  return [...new Set(filtered)].slice(0, 5);
}

// Extract phone numbers from content
function extractPhones(content: string): string[] {
  const phonePattern = /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const phones = content.match(phonePattern) || [];
  return [...new Set(phones)].slice(0, 3);
}

// Extract services from content
function extractServices(content: string): string[] {
  const contentLower = content.toLowerCase();
  const foundServices: string[] = [];

  for (const service of SERVICE_KEYWORDS) {
    if (contentLower.includes(service)) {
      foundServices.push(service.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
    }
  }

  return foundServices.slice(0, 15);
}

// Extract languages from content
function extractLanguages(content: string): string[] {
  const contentLower = content.toLowerCase();
  const foundLanguages: string[] = [];

  const languageIndicators = [
    "languages spoken", "we speak", "languages:", "fluent in",
    "bilingual", "multilingual", "langues parlées", "nous parlons",
  ];
  const hasLanguageSection = languageIndicators.some((ind) => contentLower.includes(ind));

  for (const [langName, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        if (hasLanguageSection || ["speak", "fluent", "language"].some((ind) => contentLower.includes(ind))) {
          if (!foundLanguages.includes(langName)) {
            foundLanguages.push(langName);
          }
          break;
        }
      }
    }
  }

  if (foundLanguages.length === 0) {
    const frenchIndicators = ["québec", "quebec", "montréal", "montreal", "laval", "gatineau"];
    if (frenchIndicators.some((ind) => contentLower.includes(ind))) {
      return ["French", "English"];
    }
    return ["English"];
  }

  return foundLanguages.slice(0, 10);
}

// Helper function to attempt a single scrape with given options
async function attemptScrape(
  url: string,
  options: Record<string, unknown>,
  strategyName: string
): Promise<EnrichmentData | null> {
  try {
    const response = await fetchWithTimeout(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, ...options }),
    });

    if (!response.ok) {
      const status = response.status;
      // Log status codes that indicate blocking (useful for debugging)
      if (status === 401 || status === 403 || status === 500) {
        console.warn(`[Edge Enrich] ${strategyName} blocked (${status}): ${url}`);
      } else {
        console.warn(`[Edge Enrich] ${strategyName} failed (${status}): ${url}`);
      }
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.data?.markdown) {
      console.warn(`[Edge Enrich] ${strategyName} no content: ${url}`);
      return null;
    }

    const content = data.data.markdown;
    const metadata = data.data.metadata || {};

    console.log(`[Edge Enrich] ${strategyName} success: ${url}`);

    return {
      url,
      title: metadata.title || "",
      description: metadata.description || "",
      practitioners: extractPractitioners(content),
      emails: extractEmails(content),
      phones: extractPhones(content),
      services: extractServices(content),
      languages: extractLanguages(content),
      raw_text_preview: content.slice(0, 1000),
    };
  } catch (error) {
    console.error(`[Edge Enrich] ${strategyName} error for ${url}:`, error);
    return null;
  }
}

// Scrape a single website using Firecrawl with retry strategies
async function scrapeWebsite(websiteUrl: string): Promise<EnrichmentData | null> {
  // Strategy 1: Normal scrape with waitFor for JavaScript rendering
  const result = await attemptScrape(websiteUrl, {
    formats: ["markdown"],
    onlyMainContent: false,
    timeout: 60000,      // Increased from 30s to 60s
    waitFor: 5000,       // Wait 5s for JS to render
    location: { country: "US", languages: ["en"] },
  }, "Normal");

  if (result) return result;

  // Strategy 2: Retry with stealth proxy for blocked sites
  console.log(`[Edge Enrich] Retrying with stealth proxy: ${websiteUrl}`);
  const stealthResult = await attemptScrape(websiteUrl, {
    formats: ["markdown"],
    onlyMainContent: false,
    timeout: 60000,
    waitFor: 5000,
    proxy: "stealth",
  }, "Stealth");

  if (stealthResult) return stealthResult;

  // Strategy 3: Mobile mode for responsive-only sites
  console.log(`[Edge Enrich] Retrying with mobile mode: ${websiteUrl}`);
  const mobileResult = await attemptScrape(websiteUrl, {
    formats: ["markdown"],
    onlyMainContent: false,
    timeout: 60000,
    waitFor: 3000,
    mobile: true,
  }, "Mobile");

  return mobileResult;
}

// Enrich a single practitioner
async function enrichPractitioner(
  supabase: ReturnType<typeof createClient>,
  practitioner: Practitioner
): Promise<EnrichmentResult> {
  const { id, name, website } = practitioner;

  try {
    // SSRF protection: validate URL before fetching
    if (!isValidExternalUrl(website)) {
      console.warn(`[Edge Enrich] Skipping invalid/unsafe URL for ${name}: ${website}`);
      await supabase
        .from("practitioners")
        .update({
          enrichment_status: "failed",
          enrichment: { scraped_at: new Date().toISOString(), success: false, error: "Invalid or disallowed URL" },
        })
        .eq("id", id);
      return { practitionerId: id, name, success: false, error: "Invalid URL" };
    }

    // Mark as in-progress
    await supabase
      .from("practitioners")
      .update({ enrichment_status: "in_progress" })
      .eq("id", id);

    // Scrape the website
    const enrichmentData = await scrapeWebsite(website);

    if (!enrichmentData) {
      await supabase
        .from("practitioners")
        .update({
          enrichment_status: "failed",
          enrichment: { scraped_at: new Date().toISOString(), success: false, error: "Failed to scrape" },
        })
        .eq("id", id);

      return { practitionerId: id, name, success: false, error: "Failed to scrape website" };
    }

    // Update with enrichment data
    const enrichmentPayload = {
      scraped_at: new Date().toISOString(),
      success: true,
      data: enrichmentData,
    };

    const { error } = await supabase
      .from("practitioners")
      .update({
        enrichment: enrichmentPayload,
        enrichment_status: "enriched",
        enriched_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(`[Edge Enrich] DB update error for ${name}:`, error.message);
      return { practitionerId: id, name, success: false, error: error.message };
    }

    console.log(`[Edge Enrich] Success: ${name} - ${enrichmentData.emails.length} emails, ${enrichmentData.practitioners.length} team members`);
    return { practitionerId: id, name, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Edge Enrich] Error for ${name}:`, errorMsg);
    return { practitionerId: id, name, success: false, error: errorMsg };
  }
}

// Main handler
// CORS and auth helpers
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function verifyServiceAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify caller is authorized (service role key)
  if (!verifyServiceAuth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Check configuration
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Cleanup stale "in_progress" statuses (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: staleRecords, error: staleError } = await supabase
      .from("practitioners")
      .update({ enrichment_status: "pending" })
      .eq("enrichment_status", "in_progress")
      .lt("updated_at", fiveMinutesAgo)
      .select("id");
    
    if (!staleError && staleRecords && staleRecords.length > 0) {
      console.log(`[Edge Enrich] Reset ${staleRecords.length} stale in_progress records to pending`);
    }

    // Parse request body
    const body = await req.json();
    const { practitionerIds, enrichAll, includeRetries } = body;

    let practitioners: Practitioner[] = [];

    if (practitionerIds && Array.isArray(practitionerIds) && practitionerIds.length > 0) {
      // Fetch specific practitioners by ID
      const { data, error } = await supabase
        .from("practitioners")
        .select("id, name, website")
        .in("id", practitionerIds)
        .not("website", "is", null);

      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch practitioners: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      practitioners = (data || []) as Practitioner[];
    } else if (enrichAll) {
      // Fetch all pending practitioners with websites
      // Optionally include failed practitioners for retry
      const statusFilter = includeRetries ? ["pending", "failed"] : ["pending"];
      
      const { data, error } = await supabase
        .from("practitioners")
        .select("id, name, website")
        .in("enrichment_status", statusFilter)
        .not("website", "is", null)
        .limit(200); // Safety limit

      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch practitioners: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Edge Enrich] Found ${(data || []).length} practitioners with status in [${statusFilter.join(', ')}]`);
      practitioners = (data || []) as Practitioner[];
    } else {
      return new Response(
        JSON.stringify({ error: "Either practitionerIds array or enrichAll=true required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (practitioners.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No practitioners to enrich", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Edge Enrich] Starting enrichment for ${practitioners.length} practitioners`);

    // Process in batches of BATCH_SIZE concurrent requests
    const results: EnrichmentResult[] = [];

    for (let i = 0; i < practitioners.length; i += BATCH_SIZE) {
      const batch = practitioners.slice(i, i + BATCH_SIZE);
      console.log(`[Edge Enrich] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} practitioners`);

      // Process batch in parallel - use allSettled to preserve successful results on partial failure
      const settled = await Promise.allSettled(
        batch.map((p) => enrichPractitioner(supabase, p))
      );

      const batchResults = settled.map((r, idx) =>
        r.status === "fulfilled"
          ? r.value
          : { practitionerId: batch[idx].id, name: batch[idx].name, success: false, error: r.reason?.message || "Unknown error" }
      );

      results.push(...batchResults);
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`[Edge Enrich] Complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: practitioners.length,
        enriched: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Edge Enrich] Fatal error:", errorMsg);

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
