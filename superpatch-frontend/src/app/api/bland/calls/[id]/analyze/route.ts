import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { AnalyzeCallSchema, validateBody } from "@/lib/validation";
import { getEnvVar } from "@/lib/config/env";

const API_KEY = getEnvVar("BLAND_API_KEY");
const BASE_URL = "https://api.bland.ai/v1";

// POST /api/bland/calls/[id]/analyze - Analyze a call
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!API_KEY) {
    return NextResponse.json({ status: "error", message: "BLAND_API_KEY not configured" }, { status: 503 });
  }

  const { id } = await params;
  
  try {
    const body = await request.json().catch(() => ({}));
    const validation = validateBody(AnalyzeCallSchema, body);
    if (!validation.success) {
      return NextResponse.json({ status: "error", message: validation.error }, { status: 400 });
    }
    
    const response = await fetch(`${BASE_URL}/calls/${id}/analyze`, {
      method: "POST",
      headers: {
        "authorization": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validation.data),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error("Bland.ai API error (analyze):", response.status, data);
      return NextResponse.json(
        { status: "error", message: data?.message || `Bland.ai error: ${response.status}` },
        { status: response.status === 429 ? 429 : response.status >= 500 ? 502 : 400 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error analyzing call:", error);
    return NextResponse.json({ status: "error", message: "Failed to analyze call" }, { status: 500 });
  }
}
