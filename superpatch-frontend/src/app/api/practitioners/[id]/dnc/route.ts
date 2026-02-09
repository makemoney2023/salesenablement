import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { DNCRequestSchema, validateBody } from "@/lib/validation";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

interface DNCMarkRequest {
  action: 'mark';
  reason: string;
}

interface DNCRestoreRequest {
  action: 'restore';
  confirmation: boolean;
}

type DNCRequest = DNCMarkRequest | DNCRestoreRequest;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Practitioner ID is required" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const rawBody = await request.json();
    const validation = validateBody(DNCRequestSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const body: DNCRequest = validation.data as DNCRequest;

    // Check if practitioner exists
    const { data: practitionerData, error: lookupError } = await supabaseAdmin
      .from('practitioners')
      .select('id, name, do_not_call')
      .eq('id', id)
      .single();

    if (lookupError || !practitionerData) {
      return NextResponse.json(
        { error: "Practitioner not found" },
        { status: 404 }
      );
    }

    // Type assertion for new columns not yet in generated types
    const practitioner = practitionerData as { id: string; name: string; do_not_call?: boolean };

    if (body.action === 'mark') {
      // Mark as Do Not Call
      const { reason } = body as DNCMarkRequest;
      
      if (!reason || reason.trim().length === 0) {
        return NextResponse.json(
          { error: "Reason is required when marking as Do Not Call" },
          { status: 400 }
        );
      }

      if (practitioner.do_not_call) {
        return NextResponse.json(
          { error: "Practitioner is already marked as Do Not Call" },
          { status: 409 }
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabaseAdmin as any)
        .from('practitioners')
        .update({
          do_not_call: true,
          dnc_reason: reason.trim(),
          dnc_detected_at: new Date().toISOString(),
          dnc_source: 'manual',
        })
        .eq('id', id);

      if (updateError) {
        console.error("Error marking practitioner as DNC:", updateError);
        return NextResponse.json(
          { error: "Failed to update practitioner" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${practitioner.name} has been marked as Do Not Call`,
        practitioner_id: id,
        action: 'marked_dnc',
      });

    } else {
      // Restore from Do Not Call
      const { confirmation } = body as DNCRestoreRequest;
      
      if (!confirmation) {
        return NextResponse.json(
          { error: "Confirmation is required to restore from Do Not Call" },
          { status: 400 }
        );
      }

      if (!practitioner.do_not_call) {
        return NextResponse.json(
          { error: "Practitioner is not currently marked as Do Not Call" },
          { status: 409 }
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabaseAdmin as any)
        .from('practitioners')
        .update({
          do_not_call: false,
          dnc_reason: null,
          dnc_detected_at: null,
          dnc_source: null,
        })
        .eq('id', id);

      if (updateError) {
        console.error("Error restoring practitioner from DNC:", updateError);
        return NextResponse.json(
          { error: "Failed to update practitioner" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${practitioner.name} has been restored to active list`,
        practitioner_id: id,
        action: 'restored',
      });
    }

  } catch (error) {
    console.error("DNC endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check DNC status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const { data: practitionerData, error } = await supabaseAdmin
      .from('practitioners')
      .select('id, name, do_not_call, dnc_reason, dnc_detected_at, dnc_source')
      .eq('id', id)
      .single();

    if (error || !practitionerData) {
      return NextResponse.json(
        { error: "Practitioner not found" },
        { status: 404 }
      );
    }

    // Type assertion for new columns not yet in generated types
    const practitioner = practitionerData as {
      id: string;
      name: string;
      do_not_call?: boolean;
      dnc_reason?: string | null;
      dnc_detected_at?: string | null;
      dnc_source?: string | null;
    };

    return NextResponse.json({
      practitioner_id: practitioner.id,
      name: practitioner.name,
      do_not_call: practitioner.do_not_call || false,
      dnc_reason: practitioner.dnc_reason,
      dnc_detected_at: practitioner.dnc_detected_at,
      dnc_source: practitioner.dnc_source,
    });

  } catch (error) {
    console.error("DNC status check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
