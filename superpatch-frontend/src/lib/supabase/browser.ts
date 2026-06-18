"use client";

import { createClient } from "@/lib/supabase/client";
import type { TypedSupabaseClient } from "@/lib/supabase";

export const isBrowserSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

let cached: TypedSupabaseClient | null = null;

/**
 * Session-aware browser Supabase client.
 *
 * Unlike the anon singleton in `@/lib/supabase`, this is the `@supabase/ssr`
 * browser client (cookie session) used by the auth flow, so its reads run as
 * the logged-in user and pass `is_active_user()` RLS. Realtime is
 * auto-authenticated from the same session.
 */
export function getBrowserSupabase(): TypedSupabaseClient | null {
  if (!isBrowserSupabaseConfigured) return null;
  if (typeof window === "undefined") return null;
  if (!cached) cached = createClient() as unknown as TypedSupabaseClient;
  return cached;
}
