import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getEnvVar } from "@/lib/config/env";

const BLAND_API_KEY = getEnvVar("BLAND_API_KEY");
const BLAND_API_URL = "https://api.bland.ai/v1";

interface BlandListenResponse {
  status: "success" | "error";
  data?: {
    url: string;
  };
  errors?: Array<{ code: string; message: string }>;
}

/**
 * POST /api/bland/calls/[id]/listen
 * 
 * Initiates a live listen session for an active call and returns a WebSocket URL.
 * The WebSocket streams real-time audio from the call.
 * 
 * Prerequisites:
 * - live_listen_enabled must be true in Bland.ai organization preferences
 * - Call must be in active status (not completed)
 * 
 * WebSocket Audio Format:
 * - PCM Int16 (16-bit signed integers)
 * - Sample Rate: 16,000 Hz
 * - Channels: Mono (1 channel)
 * - Byte Order: Little-endian
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  const { id: callId } = await params;

  if (!BLAND_API_KEY) {
    return NextResponse.json(
      { error: "Bland API key not configured" },
      { status: 500 }
    );
  }

  if (!callId) {
    return NextResponse.json(
      { error: "Call ID is required" },
      { status: 400 }
    );
  }

  try {
    console.log(`🎧 Requesting live listen for call: ${callId}`);

    const response = await fetch(`${BLAND_API_URL}/calls/${callId}/listen`, {
      method: "POST",
      headers: {
        "Authorization": BLAND_API_KEY,
        "Content-Type": "application/json",
      },
    });

    const data: BlandListenResponse = await response.json();

    if (!response.ok) {
      console.error(`❌ Live listen request failed:`, data);
      
      // Handle specific error cases
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Call not found or does not belong to your organization" },
          { status: 404 }
        );
      }
      
      if (response.status === 400) {
        // Could be: call not active, live listen not enabled, etc.
        const errorMessage = data.errors?.[0]?.message || "Call is not available for live listening";
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to initiate live listen session" },
        { status: response.status }
      );
    }

    if (data.status === "success" && data.data?.url) {
      console.log(`✅ Live listen session started for call: ${callId}`);
      return NextResponse.json({
        success: true,
        websocketUrl: data.data.url,
        callId,
        audioFormat: {
          type: "PCM Int16",
          sampleRate: 16000,
          channels: 1,
          byteOrder: "little-endian",
        },
      });
    }

    return NextResponse.json(
      { error: "Unexpected response from Bland.ai" },
      { status: 500 }
    );

  } catch (error) {
    console.error(`❌ Error initiating live listen:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bland/calls/[id]/listen
 * 
 * Returns information about the live listen feature.
 */
export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  return NextResponse.json({
    endpoint: "Live Listen API",
    method: "POST",
    description: "Initiates a live listen session for an active call",
    prerequisites: [
      "live_listen_enabled must be true in Bland.ai organization preferences",
      "Call must be in active status (not completed)",
    ],
    audioFormat: {
      type: "PCM Int16",
      sampleRate: 16000,
      channels: 1,
      byteOrder: "little-endian",
      description: "Binary audio data received via WebSocket",
    },
    usage: {
      step1: "POST to this endpoint with the call ID",
      step2: "Connect to the returned WebSocket URL",
      step3: "Process incoming binary audio data",
      step4: "Convert Int16 to Float32 for Web Audio API playback",
    },
  });
}
