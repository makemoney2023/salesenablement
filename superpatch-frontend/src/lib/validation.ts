/**
 * Zod validation schemas for API route inputs.
 * Apply using schema.safeParse(body) at the top of route handlers.
 */

import { z } from "zod";

// ---- Bland.ai Call Schemas ----

export const CreateBlandCallSchema = z.object({
  phone_number: z.string().min(10).max(20),
  pathway_id: z.string().optional(),
  voice: z.string().optional(),
  webhook: z.string().url().optional(),
  request_data: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  knowledge_base: z.string().optional(),
  memory_id: z.string().optional(),
}).passthrough(); // Allow additional Bland.ai params

export const AnalyzeCallSchema = z.object({
  goal: z.string().optional(),
  questions: z.array(z.array(z.string())).optional(),
}).passthrough();

// ---- Campaign Call Schemas ----

export const CreateCallRecordSchema = z.object({
  practitioner_id: z.string().optional(),
  call_id: z.string().optional(),
  practitioner_name: z.string().max(500).optional(),
  practitioner_type: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  province: z.string().max(200).optional(),
  status: z.string().optional(),
  call_started_at: z.string().optional(),
  call_ended_at: z.string().optional(),
  duration_seconds: z.number().optional(),
  transcript: z.string().optional(),
  summary: z.string().optional(),
  appointment_booked: z.boolean().optional(),
  appointment_time: z.string().optional(),
  calendar_invite_sent: z.boolean().optional(),
  practitioner_email: z.string().email().optional().or(z.literal("")),
  booking_id: z.string().optional(),
  notes: z.string().max(5000).optional(),
}).refine(
  (data) => data.practitioner_id || data.call_id,
  { message: "practitioner_id or call_id is required" }
);

export const UpdateCallRecordSchema = z.object({
  practitioner_id: z.string(),
}).passthrough(); // Allow any update fields

// ---- Campaign Notes Schemas ----

export const CreateNoteSchema = z.object({
  call_record_id: z.string().uuid(),
  content: z.string().min(1).max(10000),
  created_by: z.string().optional(),
});

export const UpdateNoteSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

// ---- Practitioner Schemas ----

export const CreatePractitionerSchema = z.object({
  name: z.string().min(1).max(500),
  phone: z.string().min(7).max(20),
  practitioner_type: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  province: z.string().max(200).optional(),
  country: z.string().max(5).optional(),
  website: z.string().url().optional().or(z.literal("")).or(z.literal(null)),
  notes: z.string().max(5000).optional(),
});

// ---- DNC Schemas ----

export const DNCMarkSchema = z.object({
  action: z.literal("mark"),
  reason: z.string().min(1).max(500),
});

export const DNCRestoreSchema = z.object({
  action: z.literal("restore"),
  confirmation: z.literal(true),
});

export const DNCRequestSchema = z.discriminatedUnion("action", [
  DNCMarkSchema,
  DNCRestoreSchema,
]);

// ---- Search Schemas ----

export const PlacesSearchSchema = z.object({
  query: z.string().min(1).max(500),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radius: z.number().min(100).max(50000),
  }),
  country: z.enum(["CA", "US"]),
  limit: z.number().min(1).max(100).optional(),
});

const ImportPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  country: z.string().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  review_count: z.number().nullable().optional(),
  business_status: z.string().optional(),
  google_maps_uri: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  practitioner_type: z.string().optional(),
}).passthrough();

export const ImportPractitionersSchema = z.object({
  places: z.array(ImportPlaceSchema).min(1).max(100),
  enrichmentCache: z.record(z.string(), z.unknown()).optional(),
});

export const EnrichRequestSchema = z.object({
  practitionerId: z.string().optional(),
  websiteUrl: z.string().url(),
  force: z.boolean().optional(),
});

// ---- Sample Schemas ----

export const UpdateSampleSchema = z.object({
  id: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).optional(),
  status: z.string().optional(),
  tracking_number: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  shipped_at: z.string().optional(),
}).refine(
  (data) => data.id || (data.ids && data.ids.length > 0),
  { message: "id or ids is required" }
);

// ---- Pathway Export Schemas ----

export const PathwayExportSchema = z.object({
  practitioner_type: z.string().min(1).max(100),
});

// ---- Memory Schemas ----

export const MemoryActionSchema = z.object({
  action: z.enum(["create", "sync", "insert"]),
}).passthrough();

// ---- Helper for validation in route handlers ----

/**
 * Validates request body against a Zod schema.
 * Returns the parsed data or a NextResponse error.
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    );
    return { success: false, error: `Validation failed: ${issues.join("; ")}` };
  }
  return { success: true, data: result.data };
}
