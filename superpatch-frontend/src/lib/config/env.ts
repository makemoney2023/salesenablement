/**
 * Server-side environment variable validation.
 * 
 * Import this module in API routes to validate required env vars
 * before making external API calls. Provides clear error messages
 * instead of silent failures from empty-string fallbacks.
 */

type EnvVarConfig = {
  key: string;
  required: boolean;
  description: string;
};

const SERVER_ENV_VARS: EnvVarConfig[] = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", required: true, description: "Supabase project URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, description: "Supabase anon key" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", required: true, description: "Supabase service role key" },
  { key: "BLAND_API_KEY", required: true, description: "Bland.ai API key" },
  { key: "GOOGLE_MAPS_API_KEY", required: false, description: "Google Maps API key (for search)" },
  { key: "FIRECRAWL_API_KEY", required: false, description: "Firecrawl API key (for enrichment)" },
  { key: "CAL_API_KEY", required: false, description: "Cal.com API key (for appointments)" },
];

/**
 * Check if a specific env var is set and non-empty.
 * Use this at the top of API routes that depend on specific services.
 */
export function requireEnvVar(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Check .env.local or deployment environment configuration.`
    );
  }
  return value;
}

/**
 * Check if a specific env var is set (returns null if missing).
 */
export function getEnvVar(key: string): string | null {
  const value = process.env[key];
  if (!value || value.trim() === "") return null;
  return value;
}

/**
 * Validate all required server env vars at startup.
 * Call this from instrumentation.ts or a server-side init function.
 * Returns list of missing vars (empty array = all good).
 */
export function validateServerEnv(): { missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const { key, required, description } of SERVER_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      if (required) {
        missing.push(`${key} (${description})`);
      } else {
        warnings.push(`${key} (${description}) - optional but recommended`);
      }
    }
  }

  return { missing, warnings };
}

/**
 * Log env var validation results at startup.
 */
export function logEnvValidation(): void {
  const { missing, warnings } = validateServerEnv();

  if (missing.length > 0) {
    console.error(
      `[ENV] CRITICAL: Missing required environment variables:\n` +
      missing.map(m => `  - ${m}`).join("\n")
    );
  }

  if (warnings.length > 0) {
    console.warn(
      `[ENV] Missing optional environment variables:\n` +
      warnings.map(w => `  - ${w}`).join("\n")
    );
  }

  if (missing.length === 0 && warnings.length === 0) {
    console.log("[ENV] All environment variables configured.");
  }
}
