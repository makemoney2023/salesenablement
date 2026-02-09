import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { UpdateSampleSchema, validateBody } from "@/lib/validation";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import type { SampleRequest } from "@/lib/db/types";

// GET /api/samples - Fetch sample requests with filtering and pagination
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const statusParam = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const search = searchParams.get("search");
  const format = searchParams.get("format"); // "csv" for export

  try {
    // Build query - use type assertion since sample_requests is a new table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from("sample_requests")
      .select("*", { count: "exact" });

    // Apply filters
    if (statusParam && statusParam !== "all") {
      query = query.eq("status", statusParam);
    }

    if (search) {
      query = query.or(
        `requester_name.ilike.%${search}%,practice_name.ilike.%${search}%,phone.ilike.%${search}%,shipping_city.ilike.%${search}%`
      );
    }

    // Order by created_at descending (newest first)
    query = query.order("created_at", { ascending: false });

    // If CSV export, get all records
    if (format === "csv") {
      const { data, error } = await query;

      if (error) {
        console.error("Error fetching samples for CSV:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Generate CSV
      const csv = generateCSV((data as SampleRequest[]) || []);
      
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="sample_requests_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Apply pagination for JSON response
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching samples:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      samples: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error("Samples API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch samples" },
      { status: 500 }
    );
  }
}

// PATCH /api/samples - Update sample request(s)
// Auth checked inside handler
export async function PATCH(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const validation = validateBody(UpdateSampleSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    const { id, ids, ...updates } = validation.data;

    const targetIds = ids || (id ? [id] : []);

    // If status is "shipped", set shipped_at timestamp
    if (updates.status === "shipped" && !updates.shipped_at) {
      updates.shipped_at = new Date().toISOString();
    }

    // Update all specified records - use type assertion for new table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("sample_requests")
      .update(updates)
      .in("id", targetIds)
      .select();

    if (error) {
      console.error("Error updating samples:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      samples: data,
    });
  } catch (error) {
    console.error("Samples PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update samples" },
      { status: 500 }
    );
  }
}

// Helper to generate CSV from sample requests
function generateCSV(samples: SampleRequest[]): string {
  if (samples.length === 0) {
    return "No data";
  }

  // Define CSV columns
  const columns: { key: keyof SampleRequest; header: string }[] = [
    { key: "created_at", header: "Request Date" },
    { key: "requester_name", header: "Requester Name" },
    { key: "practice_name", header: "Practice Name" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "shipping_address", header: "Shipping Address" },
    { key: "shipping_city", header: "City" },
    { key: "shipping_province", header: "Province" },
    { key: "shipping_postal_code", header: "Postal Code" },
    { key: "sample_type", header: "Sample Type" },
    { key: "products_requested", header: "Products Requested" },
    { key: "quantity", header: "Quantity" },
    { key: "status", header: "Status" },
    { key: "tracking_number", header: "Tracking Number" },
    { key: "shipped_at", header: "Shipped Date" },
    { key: "notes", header: "Notes" },
  ];

  // Build header row
  const header = columns.map((c) => `"${c.header}"`).join(",");

  // Build data rows
  const rows = samples.map((sample) => {
    return columns
      .map((col) => {
        let value: string | number | boolean | string[] | null = sample[col.key];

        // Format dates
        if (col.key === "created_at" || col.key === "shipped_at") {
          value = value ? new Date(value as string).toLocaleDateString() : "";
        }

        // Format arrays
        if (Array.isArray(value)) {
          value = value.join(", ");
        }

        // Escape quotes and wrap in quotes
        const stringValue = String(value ?? "").replace(/"/g, '""');
        return `"${stringValue}"`;
      })
      .join(",");
  });

  return [header, ...rows].join("\n");
}
