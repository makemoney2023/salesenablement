/**
 * Tests for Zod validation schemas (src/lib/validation.ts)
 *
 * Covers all schemas and the validateBody helper function.
 */
import { describe, it, expect } from 'vitest';
import {
  CreateBlandCallSchema,
  AnalyzeCallSchema,
  CreateCallRecordSchema,
  UpdateCallRecordSchema,
  CreateNoteSchema,
  UpdateNoteSchema,
  CreatePractitionerSchema,
  DNCRequestSchema,
  PlacesSearchSchema,
  ImportPractitionersSchema,
  EnrichRequestSchema,
  UpdateSampleSchema,
  PathwayExportSchema,
  MemoryActionSchema,
  validateBody,
} from '@/lib/validation';

// ============================================================
// validateBody helper
// ============================================================
describe('validateBody', () => {
  it('returns success: true with parsed data on valid input', () => {
    const schema = CreatePractitionerSchema;
    const result = validateBody(schema, { name: 'Dr. Smith', phone: '4165551234' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Dr. Smith');
      expect(result.data.phone).toBe('4165551234');
    }
  });

  it('returns success: false with error string on invalid input', () => {
    const schema = CreatePractitionerSchema;
    const result = validateBody(schema, { name: '', phone: '123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Validation failed');
    }
  });

  it('returns failure for completely wrong types', () => {
    const result = validateBody(CreatePractitionerSchema, 'not an object');
    expect(result.success).toBe(false);
  });

  it('returns failure for null input', () => {
    const result = validateBody(CreatePractitionerSchema, null);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// CreateBlandCallSchema
// ============================================================
describe('CreateBlandCallSchema', () => {
  it('accepts a valid call payload', () => {
    const data = {
      phone_number: '+14165551234',
      pathway_id: 'abc-123',
      webhook: 'https://example.com/webhook',
      request_data: { key: 'value' },
      metadata: { campaign: 'test' },
    };
    const result = CreateBlandCallSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects a phone number that is too short', () => {
    const result = CreateBlandCallSchema.safeParse({ phone_number: '123' });
    expect(result.success).toBe(false);
  });

  it('rejects missing phone_number', () => {
    const result = CreateBlandCallSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('allows extra passthrough fields', () => {
    const data = {
      phone_number: '+14165551234',
      custom_field: 'hello',
    };
    const result = CreateBlandCallSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).custom_field).toBe('hello');
    }
  });

  it('rejects invalid webhook URL', () => {
    const result = CreateBlandCallSchema.safeParse({
      phone_number: '+14165551234',
      webhook: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// AnalyzeCallSchema
// ============================================================
describe('AnalyzeCallSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = AnalyzeCallSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid goal and questions', () => {
    const result = AnalyzeCallSchema.safeParse({
      goal: 'Check if interested',
      questions: [['Question 1', 'Answer pattern']],
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// CreateCallRecordSchema
// ============================================================
describe('CreateCallRecordSchema', () => {
  it('accepts record with practitioner_id', () => {
    const result = CreateCallRecordSchema.safeParse({
      practitioner_id: 'uuid-123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts record with call_id', () => {
    const result = CreateCallRecordSchema.safeParse({
      call_id: 'call-abc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects record with neither practitioner_id nor call_id', () => {
    const result = CreateCallRecordSchema.safeParse({
      practitioner_name: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('accepts full record', () => {
    const result = CreateCallRecordSchema.safeParse({
      practitioner_id: 'uuid-123',
      call_id: 'call-abc',
      practitioner_name: 'Dr. Smith',
      phone: '+14165551234',
      status: 'completed',
      duration_seconds: 120,
      appointment_booked: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty email (allows empty string)', () => {
    const result = CreateCallRecordSchema.safeParse({
      practitioner_id: 'uuid-123',
      practitioner_email: '',
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// UpdateCallRecordSchema
// ============================================================
describe('UpdateCallRecordSchema', () => {
  it('accepts record with practitioner_id and update fields', () => {
    const result = UpdateCallRecordSchema.safeParse({
      practitioner_id: 'uuid-123',
      status: 'completed',
      notes: 'Call went well',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing practitioner_id', () => {
    const result = UpdateCallRecordSchema.safeParse({
      status: 'completed',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// CreateNoteSchema / UpdateNoteSchema
// ============================================================
describe('CreateNoteSchema', () => {
  it('accepts valid note', () => {
    const result = CreateNoteSchema.safeParse({
      call_record_id: '123e4567-e89b-12d3-a456-426614174000',
      content: 'Patient expressed interest in samples.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing content', () => {
    const result = CreateNoteSchema.safeParse({
      call_record_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = CreateNoteSchema.safeParse({
      call_record_id: '123e4567-e89b-12d3-a456-426614174000',
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for call_record_id', () => {
    const result = CreateNoteSchema.safeParse({
      call_record_id: 'not-a-uuid',
      content: 'test',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateNoteSchema', () => {
  it('accepts valid update', () => {
    const result = UpdateNoteSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      content: 'Updated note content.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const result = UpdateNoteSchema.safeParse({
      content: 'Updated note content.',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// CreatePractitionerSchema
// ============================================================
describe('CreatePractitionerSchema', () => {
  it('accepts valid practitioner', () => {
    const result = CreatePractitionerSchema.safeParse({
      name: 'Dr. Smith',
      phone: '4165551234',
      practitioner_type: 'Chiropractor',
      city: 'Toronto',
      province: 'ON',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = CreatePractitionerSchema.safeParse({
      name: '',
      phone: '4165551234',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short phone', () => {
    const result = CreatePractitionerSchema.safeParse({
      name: 'Dr. Smith',
      phone: '123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null website', () => {
    const result = CreatePractitionerSchema.safeParse({
      name: 'Dr. Smith',
      phone: '4165551234',
      website: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty string website', () => {
    const result = CreatePractitionerSchema.safeParse({
      name: 'Dr. Smith',
      phone: '4165551234',
      website: '',
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// DNCRequestSchema
// ============================================================
describe('DNCRequestSchema', () => {
  it('accepts mark action with reason', () => {
    const result = DNCRequestSchema.safeParse({
      action: 'mark',
      reason: 'Practitioner requested no further contact',
    });
    expect(result.success).toBe(true);
  });

  it('accepts restore action with confirmation', () => {
    const result = DNCRequestSchema.safeParse({
      action: 'restore',
      confirmation: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects restore without confirmation', () => {
    const result = DNCRequestSchema.safeParse({
      action: 'restore',
    });
    expect(result.success).toBe(false);
  });

  it('rejects restore with false confirmation', () => {
    const result = DNCRequestSchema.safeParse({
      action: 'restore',
      confirmation: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects mark without reason', () => {
    const result = DNCRequestSchema.safeParse({
      action: 'mark',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown action', () => {
    const result = DNCRequestSchema.safeParse({
      action: 'delete',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// PlacesSearchSchema
// ============================================================
describe('PlacesSearchSchema', () => {
  it('accepts valid search', () => {
    const result = PlacesSearchSchema.safeParse({
      query: 'chiropractor',
      location: { lat: 43.6532, lng: -79.3832, radius: 20000 },
      country: 'CA',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing query', () => {
    const result = PlacesSearchSchema.safeParse({
      location: { lat: 43.6532, lng: -79.3832, radius: 20000 },
      country: 'CA',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid country code', () => {
    const result = PlacesSearchSchema.safeParse({
      query: 'chiropractor',
      location: { lat: 43.6532, lng: -79.3832, radius: 20000 },
      country: 'UK',
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range latitude', () => {
    const result = PlacesSearchSchema.safeParse({
      query: 'chiropractor',
      location: { lat: 200, lng: -79.3832, radius: 20000 },
      country: 'CA',
    });
    expect(result.success).toBe(false);
  });

  it('rejects radius too large', () => {
    const result = PlacesSearchSchema.safeParse({
      query: 'chiropractor',
      location: { lat: 43.6532, lng: -79.3832, radius: 100000 },
      country: 'CA',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// ImportPractitionersSchema
// ============================================================
describe('ImportPractitionersSchema', () => {
  it('accepts valid import array', () => {
    const result = ImportPractitionersSchema.safeParse({
      places: [{ id: '1', name: 'Dr. Smith' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty places array', () => {
    const result = ImportPractitionersSchema.safeParse({
      places: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing places', () => {
    const result = ImportPractitionersSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects place without id', () => {
    const result = ImportPractitionersSchema.safeParse({
      places: [{ name: 'Dr. Smith' }],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// EnrichRequestSchema
// ============================================================
describe('EnrichRequestSchema', () => {
  it('accepts valid enrichment request', () => {
    const result = EnrichRequestSchema.safeParse({
      websiteUrl: 'https://example.com',
      practitionerId: 'uuid-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing websiteUrl', () => {
    const result = EnrichRequestSchema.safeParse({
      practitionerId: 'uuid-123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-URL websiteUrl', () => {
    const result = EnrichRequestSchema.safeParse({
      websiteUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// UpdateSampleSchema
// ============================================================
describe('UpdateSampleSchema', () => {
  it('accepts update with single id', () => {
    const result = UpdateSampleSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'shipped',
    });
    expect(result.success).toBe(true);
  });

  it('accepts update with ids array', () => {
    const result = UpdateSampleSchema.safeParse({
      ids: [
        '123e4567-e89b-12d3-a456-426614174000',
        '223e4567-e89b-12d3-a456-426614174000',
      ],
      status: 'approved',
    });
    expect(result.success).toBe(true);
  });

  it('rejects update without id or ids', () => {
    const result = UpdateSampleSchema.safeParse({
      status: 'shipped',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID id', () => {
    const result = UpdateSampleSchema.safeParse({
      id: 'not-a-uuid',
      status: 'shipped',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// PathwayExportSchema
// ============================================================
describe('PathwayExportSchema', () => {
  it('accepts valid practitioner type', () => {
    const result = PathwayExportSchema.safeParse({
      practitioner_type: 'Chiropractors',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty practitioner type', () => {
    const result = PathwayExportSchema.safeParse({
      practitioner_type: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing practitioner_type', () => {
    const result = PathwayExportSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ============================================================
// MemoryActionSchema
// ============================================================
describe('MemoryActionSchema', () => {
  it('accepts "create" action', () => {
    const result = MemoryActionSchema.safeParse({ action: 'create' });
    expect(result.success).toBe(true);
  });

  it('accepts "sync" action', () => {
    const result = MemoryActionSchema.safeParse({ action: 'sync' });
    expect(result.success).toBe(true);
  });

  it('accepts "insert" action', () => {
    const result = MemoryActionSchema.safeParse({ action: 'insert' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = MemoryActionSchema.safeParse({ action: 'delete' });
    expect(result.success).toBe(false);
  });

  it('allows passthrough fields', () => {
    const result = MemoryActionSchema.safeParse({
      action: 'create',
      memory_id: 'test-id',
    });
    expect(result.success).toBe(true);
  });
});
