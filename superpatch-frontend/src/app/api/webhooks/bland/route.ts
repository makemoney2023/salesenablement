import { NextResponse } from "next/server";

/**
 * @deprecated Retired 2026-05-12. This Vercel webhook route was superseded
 * by the Supabase Edge Function `/functions/v1/webhook-processor`, which
 * is the single canonical Bland.ai webhook target (see
 * b2b_sales_enablement/bland_ai_pathways/canonical_ids.json and
 * supabase/functions/_shared/pathways.ts).
 *
 * The previous implementation in this file ran ~1,370 lines of parallel
 * webhook logic with several production-affecting defects:
 *   - Cal.com v1 API (retired 2026-04-08, every booking 404'd)
 *   - Wrong email priority (AI-extracted email beat form/DB)
 *   - Boolean variables crashed `.toLowerCase()` with TypeError
 *   - Business-hours math used a fixed UTC offset (broke during DST)
 *
 * Returning 410 Gone here surfaces any pathway that is still pointed at
 * the wrong URL so it can be fixed loudly instead of double-writing rows
 * via the Edge Function.
 */

const PAYLOAD = {
  deprecated: true,
  message:
    "This webhook endpoint was retired on 2026-05-12. Repoint the Bland.ai pathway to /functions/v1/webhook-processor (see canonical_ids.json).",
  replacement: "/functions/v1/webhook-processor",
};

export async function POST(_req: Request): Promise<NextResponse> {
  return NextResponse.json(PAYLOAD, { status: 410 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(PAYLOAD, { status: 410 });
}
