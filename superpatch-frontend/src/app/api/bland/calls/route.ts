import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { CreateBlandCallSchema, validateBody } from "@/lib/validation";
import { getEnvVar } from "@/lib/config/env";

const API_KEY = getEnvVar("BLAND_API_KEY");
const BASE_URL = "https://api.bland.ai/v1";

// GET /api/bland/calls - List calls
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!API_KEY) {
    return NextResponse.json({ status: "error", message: "BLAND_API_KEY not configured" }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get("limit") || "20";
  
  try {
    const response = await fetch(`${BASE_URL}/calls?limit=${limit}`, {
      headers: {
        "authorization": API_KEY,
        "Content-Type": "application/json",
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error("Bland.ai API error (list calls):", response.status, data);
      return NextResponse.json(
        { status: "error", message: data?.message || `Bland.ai error: ${response.status}` },
        { status: response.status === 429 ? 429 : response.status >= 500 ? 502 : 400 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error listing calls:", error);
    return NextResponse.json({ status: "error", message: "Failed to list calls" }, { status: 500 });
  }
}

// POST /api/bland/calls - Make a new call
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!API_KEY) {
    return NextResponse.json({ status: "error", message: "BLAND_API_KEY not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validation = validateBody(CreateBlandCallSchema, body);
    if (!validation.success) {
      return NextResponse.json({ status: "error", message: validation.error }, { status: 400 });
    }
    
    const response = await fetch(`${BASE_URL}/calls`, {
      method: "POST",
      headers: {
        "authorization": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error("Bland.ai API error (make call):", response.status, data);
      return NextResponse.json(
        { status: "error", message: data?.message || `Bland.ai error: ${response.status}` },
        { status: response.status === 429 ? 429 : response.status >= 500 ? 502 : 400 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error making call:", error);
    return NextResponse.json({ status: "error", message: "Failed to make call" }, { status: 500 });
  }
}
