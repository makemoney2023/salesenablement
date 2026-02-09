import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { MemoryActionSchema, validateBody } from "@/lib/validation";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

import { getEnvVar } from "@/lib/config/env";

const API_KEY = getEnvVar("BLAND_API_KEY");
const BASE_URL = "https://api.bland.ai/v1";
const MEMORY_STORE_NAME = "SuperPatch Sales Campaign";

// Store the memory ID once created (you can also store this in env vars)
let cachedMemoryId: string | null = process.env.BLAND_MEMORY_ID || null;

interface BlandMemoryUser {
  phone_number: string;
  created_at: string;
  call_count: number;
  metadata: string | null;
  last_call_at: string | null;
  summary: string | null;
}

interface BlandMemoryStore {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  memory_duration: number | null;
}

// GET /api/memory - List memories or get memory details
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!API_KEY) {
    return NextResponse.json({ status: "error", message: "BLAND_API_KEY not configured" }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");
  const memoryId = searchParams.get("memory_id") || cachedMemoryId;

  try {
    // List all memory stores
    if (action === "list") {
      const response = await fetch(`${BASE_URL}/memory`, {
        headers: {
          "authorization": API_KEY,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Get details of a specific memory store (including users)
    if (action === "details" && memoryId) {
      const response = await fetch(`${BASE_URL}/memory/${memoryId}`, {
        headers: {
          "authorization": API_KEY,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Get current memory ID
    if (action === "status") {
      return NextResponse.json({
        memory_id: cachedMemoryId,
        memory_name: MEMORY_STORE_NAME,
        configured: !!cachedMemoryId,
      });
    }

    return NextResponse.json({
      status: "ok",
      message: "Bland Memory API",
      memory_id: cachedMemoryId,
      endpoints: {
        list: "GET /api/memory?action=list",
        details: "GET /api/memory?action=details&memory_id=xxx",
        status: "GET /api/memory?action=status",
        create: "POST /api/memory (action: create)",
        sync: "POST /api/memory (action: sync)",
      },
    });
  } catch (error) {
    console.error("Memory API error:", error);
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/memory - Create memory store or sync to Supabase
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!API_KEY) {
    return NextResponse.json({ status: "error", message: "BLAND_API_KEY not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validation = validateBody(MemoryActionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { status: "error", message: validation.error },
        { status: 400 }
      );
    }
    const { action } = validation.data;

    // Create a new Memory Store
    if (action === "create") {
      const response = await fetch(`${BASE_URL}/memory/create`, {
        method: "POST",
        headers: {
          "authorization": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: MEMORY_STORE_NAME,
        }),
      });

      const data = await response.json();

      if (data.data?.id) {
        cachedMemoryId = data.data.id;
        console.log(`✅ Memory Store created: ${cachedMemoryId}`);
        return NextResponse.json({
          status: "success",
          message: "Memory Store created",
          memory_id: cachedMemoryId,
          note: "Add BLAND_MEMORY_ID to your .env.local file to persist this",
        });
      }

      return NextResponse.json(data);
    }

    // Sync Bland Memory data to Supabase
    if (action === "sync") {
      const memoryId = body.memory_id || cachedMemoryId;

      if (!memoryId) {
        return NextResponse.json(
          { status: "error", message: "No memory_id provided. Create a memory store first." },
          { status: 400 }
        );
      }

      if (!isSupabaseConfigured || !supabaseAdmin) {
        return NextResponse.json(
          { status: "error", message: "Supabase not configured" },
          { status: 500 }
        );
      }

      // Fetch memory data from Bland
      const response = await fetch(`${BASE_URL}/memory/${memoryId}`, {
        headers: {
          "authorization": API_KEY,
          "Content-Type": "application/json",
        },
      });

      const memoryData = await response.json();

      if (!memoryData.data?.users) {
        return NextResponse.json({
          status: "ok",
          message: "No users in memory store yet",
          synced: 0,
        });
      }

      const users: BlandMemoryUser[] = memoryData.data.users;
      let synced = 0;
      let errors = 0;

      // Update each practitioner in Supabase by phone number
      for (const user of users) {
        // Normalize phone number for matching
        const normalizedPhone = user.phone_number.replace(/\D/g, "").slice(-10);

        // Try to find and update practitioner by phone
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
          .from("practitioners")
          .update({
            bland_memory_summary: user.summary,
            bland_call_count: user.call_count,
            bland_last_call_at: user.last_call_at,
            bland_metadata: user.metadata ? { raw: user.metadata } : null,
          })
          .or(`phone.eq.${user.phone_number},phone.ilike.%${normalizedPhone}%`)
          .select();

        if (error) {
          console.error(`Failed to sync memory for ${user.phone_number}:`, error);
          errors++;
        } else if (data && data.length > 0) {
          synced++;
        }
      }

      return NextResponse.json({
        status: "success",
        message: `Synced ${synced} practitioners from Bland Memory`,
        total_in_memory: users.length,
        synced,
        errors,
      });
    }

    // Insert a user into memory (for bulk initialization)
    if (action === "insert") {
      const memoryId = body.memory_id || cachedMemoryId;
      const { phone_number, metadata, summary } = body;

      if (!memoryId) {
        return NextResponse.json(
          { status: "error", message: "No memory_id provided" },
          { status: 400 }
        );
      }

      const response = await fetch(`${BASE_URL}/memory/${memoryId}/insert`, {
        method: "POST",
        headers: {
          "authorization": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number,
          metadata,
          summary,
        }),
      });

      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { status: "error", message: "Invalid action. Use: create, sync, or insert" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Memory POST error:", error);
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}
