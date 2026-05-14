import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { CreateCallRecordSchema, UpdateCallRecordSchema, validateBody } from "@/lib/validation";
import {
  getAllCallRecords,
  getCallRecord,
  getCallRecordByCallId,
  upsertCallRecord,
  updateCallRecord,
  deleteCallRecord,
  clearAllRecords,
  getRecordsByStatus,
  getCampaignStats,
} from "@/lib/db/call-records";
import type { CallRecordInsert, CallStatus } from "@/lib/db/types";

// GET - Retrieve campaign calls
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get("call_id");
    const practitionerId = searchParams.get("practitioner_id");
    const status = searchParams.get("status") as CallStatus | null;
    const stats = searchParams.get("stats") === "true";

    // Return stats if requested
    if (stats) {
      const campaignStats = await getCampaignStats();
      return NextResponse.json({ stats: campaignStats });
    }

    // Get single record by call_id
    if (callId) {
      const record = await getCallRecordByCallId(callId);
      return NextResponse.json({
        record,
        found: !!record,
      });
    }

    // Get single record by practitioner_id
    if (practitionerId) {
      const record = await getCallRecord(practitionerId);
      return NextResponse.json({
        record,
        found: !!record,
      });
    }

    // Filter by status
    if (status) {
      const records = await getRecordsByStatus(status);
      return NextResponse.json({
        records,
        total: records.length,
      });
    }

    // Get all records
    const records = await getAllCallRecords();
    const recordsArray = Object.values(records);
    
    // Sort by updated_at desc
    recordsArray.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return NextResponse.json({
      records: Object.fromEntries(
        recordsArray.map(r => [r.practitioner_id, r])
      ),
      total: recordsArray.length,
    });
  } catch (error) {
    console.error("Failed to get campaign calls:", error);
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}

// POST - Create or update a campaign call record
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const validation = validateBody(CreateCallRecordSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { status: "error", message: validation.error },
        { status: 400 }
      );
    }

    // If we have a call_id, try to find and update existing record
    if (body.call_id && !body.practitioner_id) {
      const existing = await getCallRecordByCallId(body.call_id);
      if (existing) {
        body.practitioner_id = existing.practitioner_id;
      } else {
        // Use call_id as practitioner_id for new records without practitioner_id
        body.practitioner_id = body.call_id;
      }
    }

    const recordData: CallRecordInsert = {
      practitioner_id: body.practitioner_id,
      practitioner_name: body.practitioner_name || "Unknown",
      practitioner_type: body.practitioner_type,
      phone: body.phone || "",
      address: body.address,
      city: body.city,
      province: body.province,
      call_id: body.call_id,
      status: body.status || "not_called",
      call_started_at: body.call_started_at,
      call_ended_at: body.call_ended_at,
      duration_seconds: body.duration_seconds,
      transcript: body.transcript,
      summary: body.summary,
      appointment_booked: body.appointment_booked || false,
      appointment_time: body.appointment_time,
      calendar_invite_sent: body.calendar_invite_sent || false,
      practitioner_email: body.practitioner_email,
      booking_id: body.booking_id,
      notes: body.notes,
    };

    const record = await upsertCallRecord(recordData);

    if (!record) {
      return NextResponse.json(
        { status: "error", message: "Failed to save record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      record,
    });
  } catch (error) {
    console.error("Failed to save campaign call:", error);
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}

// PATCH - Update a specific field on a record
export async function PATCH(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const validation = validateBody(UpdateCallRecordSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { status: "error", message: validation.error },
        { status: 400 }
      );
    }
    const { practitioner_id, ...updates } = validation.data;

    const record = await updateCallRecord(practitioner_id, updates);

    if (!record) {
      return NextResponse.json(
        { status: "error", message: "Record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      record,
    });
  } catch (error) {
    console.error("Failed to update campaign call:", error);
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Clear all records or a specific one
export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.authorized) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const practitionerId = searchParams.get("practitioner_id");

    if (practitionerId) {
      const success = await deleteCallRecord(practitionerId);
      if (!success) {
        return NextResponse.json(
          { status: "error", message: "Failed to delete record" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        status: "success",
        message: "Record deleted",
      });
    }

    // Clear all records
    await clearAllRecords();
    return NextResponse.json({
      status: "success",
      message: "All records cleared",
    });
  } catch (error) {
    console.error("Failed to delete campaign call:", error);
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}
