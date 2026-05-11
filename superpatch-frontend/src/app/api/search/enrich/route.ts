import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { EnrichRequestSchema, validateBody } from "@/lib/validation";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

import { getEnvVar } from "@/lib/config/env";

const FIRECRAWL_API_KEY = getEnvVar("FIRECRAWL_API_KEY");
const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";

/**
 * Validates a URL is safe for external fetching (prevents SSRF).
 * Rejects localhost, private IPs, and non-http(s) protocols.
 */
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block localhost variants
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "[::1]") return false;
    // Block private IP ranges
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname)) return false;
    // Block .local domains
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    return true;
  } catch {
    return false;
  }
}

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

interface EnrichRequest {
  practitionerId?: string;
  websiteUrl: string;
  force?: boolean; // Force re-enrichment even if already enriched
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
        // Pattern: Name followed by comma and credentials
        const pattern = new RegExp(
          `([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?(?:\\s+[A-Z][a-z]+)?)\\s*[,\\-–]\\s*.*${cred.replace(".", "\\.")}`,
          "g"
        );
        const matches = line.matchAll(pattern);

        for (const match of matches) {
          const name = match[1].trim();
          if (name && !seenNames.has(name) && name.length > 3) {
            // Filter out common false positives
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

  return practitioners.slice(0, 10); // Max 10 practitioners
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

  // Look for language-related sections
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

  // Default to English if nothing found
  if (foundLanguages.length === 0) {
    const frenchIndicators = ["québec", "quebec", "montréal", "montreal", "laval", "gatineau"];
    if (frenchIndicators.some((ind) => contentLower.includes(ind))) {
      return ["French", "English"];
    }
    return ["English"];
  }

  return foundLanguages.slice(0, 10);
}

// Scrape website using Firecrawl
async function scrapeWebsite(websiteUrl: string): Promise<EnrichmentData | null> {
  try {
    const response = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: websiteUrl,
        formats: ["markdown"],
        onlyMainContent: false,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      console.error(`[Enrich API] Firecrawl error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.data?.markdown) {
      console.warn(`[Enrich API] No content from ${websiteUrl}`);
      return null;
    }

    const content = data.data.markdown;
    const metadata = data.data.metadata || {};

    // Extract all the data
    return {
      url: websiteUrl,
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
    console.error(`[Enrich API] Error scraping ${websiteUrl}:`, error);
    return null;
  }
}

// POST /api/search/enrich - Enrich a practitioner with website data
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    // Check for Firecrawl API key
    if (!FIRECRAWL_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Firecrawl API key not configured. Set FIRECRAWL_API_KEY environment variable.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const validation = validateBody(EnrichRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { practitionerId, websiteUrl, force } = validation.data;

    // SSRF protection: validate URL before fetching
    if (!isValidExternalUrl(websiteUrl)) {
      return NextResponse.json(
        { success: false, error: "Invalid or disallowed URL" },
        { status: 400 }
      );
    }

    // Check if practitioner is already being enriched or enriched (prevent duplicates)
    if (practitionerId && isSupabaseConfigured && supabaseAdmin && !force) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabaseAdmin as any)
          .from("practitioners")
          .select("enrichment_status, enriched_at")
          .eq("id", practitionerId)
          .single();

        if (existing) {
          if (existing.enrichment_status === "in_progress") {
            console.log(`[Enrich API] Skipping ${practitionerId} - already in_progress`);
            return NextResponse.json({
              success: false,
              skipped: true,
              error: "Enrichment already in progress for this practitioner",
            });
          }
          
          if (existing.enrichment_status === "enriched") {
            console.log(`[Enrich API] Skipping ${practitionerId} - already enriched at ${existing.enriched_at}`);
            return NextResponse.json({
              success: false,
              skipped: true,
              error: "Practitioner already enriched. Use force=true to re-enrich.",
            });
          }
        }

        // Set status to in_progress before starting
        await (supabaseAdmin as any)
          .from("practitioners")
          .update({ enrichment_status: "in_progress" })
          .eq("id", practitionerId);

      } catch (checkError) {
        console.warn(`[Enrich API] Status check failed:`, checkError);
        // Continue with enrichment if check fails
      }
    }

    console.log(`[Enrich API] Scraping: ${websiteUrl}`);

    // Scrape the website
    const enrichmentData = await scrapeWebsite(websiteUrl);

    if (!enrichmentData) {
      return NextResponse.json({
        success: false,
        error: "Failed to scrape website",
        practitioners: [],
        emails: [],
        services: [],
        languages: [],
      });
    }

    console.log(`[Enrich API] Found: ${enrichmentData.practitioners.length} practitioners, ${enrichmentData.emails.length} emails`);

    // If practitionerId provided, update the database
    if (practitionerId && isSupabaseConfigured && supabaseAdmin) {
      try {
        const enrichmentPayload = {
          scraped_at: new Date().toISOString(),
          success: true,
          data: enrichmentData,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
          .from("practitioners")
          .update({
            enrichment: enrichmentPayload,
            enrichment_status: "enriched",
            enriched_at: new Date().toISOString(),
          })
          .eq("id", practitionerId);

        if (error) {
          console.error(`[Enrich API] Failed to update practitioner: ${error.message}`);
        } else {
          console.log(`[Enrich API] Updated practitioner ${practitionerId} with enrichment data`);
        }
      } catch (dbError) {
        console.error("[Enrich API] Database error:", dbError);
      }
    }

    return NextResponse.json({
      success: true,
      practitioners: enrichmentData.practitioners,
      emails: enrichmentData.emails,
      phones: enrichmentData.phones,
      services: enrichmentData.services,
      languages: enrichmentData.languages,
      title: enrichmentData.title,
      description: enrichmentData.description,
    });
  } catch (error) {
    console.error("[Enrich API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to enrich practitioner",
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
    message: "Firecrawl Website Enrichment API",
    configured: !!FIRECRAWL_API_KEY,
    usage: {
      method: "POST",
      body: {
        websiteUrl: "string (required)",
        practitionerId: "string (optional, to update database)",
      },
    },
    extracts: [
      "practitioners (names, credentials)",
      "emails",
      "phones",
      "services offered",
      "languages spoken",
    ],
  });
}
