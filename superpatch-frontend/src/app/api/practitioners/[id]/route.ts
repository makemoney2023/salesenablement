import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { UpdatePractitionerSchema, validateBody } from "@/lib/validation";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

/**
 * PATCH /api/practitioners/[id]
 *
 * Updates a whitelisted subset of editable practitioner fields. Uses the
 * service-role admin client (route is protected by requireApiAuth()).
 */
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
        { status: "error", message: "Practitioner ID is required" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json(
        { status: "error", message: "Database not configured" },
        { status: 503 }
      );
    }

    const rawBody = await request.json();
    const validation = validateBody(UpdatePractitionerSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { status: "error", message: validation.error },
        { status: 400 }
      );
    }

    // Only keep keys that were actually provided (Zod already stripped any
    // non-whitelisted fields).
    const updates = Object.fromEntries(
      Object.entries(validation.data).filter(([, v]) => v !== undefined)
    );

    // Confirm the practitioner exists for a clean 404.
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("practitioners")
      .select("id")
      .eq("id", id)
      .single();

    if (lookupError || !existing) {
      return NextResponse.json(
        { status: "error", message: "Practitioner not found" },
        { status: 404 }
      );
    }

    const { data, error } = await (supabaseAdmin as any)
      .from("practitioners")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update practitioner:", error);
      return NextResponse.json(
        { status: "error", message: "Failed to update practitioner" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "success", data });
  } catch (error) {
    console.error("Practitioner PATCH error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/practitioners/[id]
 *
 * Permanently removes a practitioner. Uses the service-role admin client
 * (route is protected by requireApiAuth()).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { status: "error", message: "Practitioner ID is required" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured || !supabaseAdmin) {
      return NextResponse.json(
        { status: "error", message: "Database not configured" },
        { status: 503 }
      );
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("practitioners")
      .select("id")
      .eq("id", id)
      .single();

    if (lookupError || !existing) {
      return NextResponse.json(
        { status: "error", message: "Practitioner not found" },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from("practitioners")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete practitioner:", error);
      return NextResponse.json(
        { status: "error", message: "Failed to delete practitioner" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "success", message: "Practitioner deleted" });
  } catch (error) {
    console.error("Practitioner DELETE error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
