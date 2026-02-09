/**
 * Tests for Database types (src/lib/db/types.ts)
 *
 * Verifies that all tables are present in the Database interface,
 * convenience types are correctly exported, and type aliases have expected values.
 */
import { describe, it, expect } from 'vitest';
import type {
  Database,
  CallStatus,
  SampleStatus,
  AppointmentStatus,
  AnalysisStatus,
  InterestLevel,
  ContactRole,
  FollowUpAction,
  RetryReason,
  PathwaySuggestionType,
  PathwaySuggestionSeverity,
  PathwaySuggestionStatus,
  // Convenience types
  Practitioner,
  PractitionerInsert,
  PractitionerUpdate,
  FollowUpQueueItem,
  FollowUpQueueInsert,
  FollowUpQueueUpdate,
  CallRecord,
  SampleRequest,
  Appointment,
  CampaignAnalytics,
} from '@/lib/db/types';

// Helper: assert a type is not never (proves the type resolves)
type IsNotNever<T> = [T] extends [never] ? false : true;

describe('Database interface', () => {
  it('includes all required table names', () => {
    // TypeScript compilation proves these exist - this test
    // documents the expected tables for human readers
    type Tables = Database['public']['Tables'];
    type TableNames = keyof Tables;

    // Use a runtime array that mirrors the type check
    const expectedTables: TableNames[] = [
      'user_profiles',
      'call_records',
      'call_notes',
      'campaign_analytics',
      'sample_requests',
      'appointments',
      'practitioners',
      'follow_up_queue',
      'pathway_suggestions',
    ];

    expect(expectedTables).toHaveLength(9);
  });

  it('practitioners table has Row, Insert, and Update types', () => {
    // These compile only if the types exist
    const check: IsNotNever<Practitioner> = true;
    const checkInsert: IsNotNever<PractitionerInsert> = true;
    const checkUpdate: IsNotNever<PractitionerUpdate> = true;
    expect(check).toBe(true);
    expect(checkInsert).toBe(true);
    expect(checkUpdate).toBe(true);
  });

  it('follow_up_queue table has Row, Insert, and Update types', () => {
    const check: IsNotNever<FollowUpQueueItem> = true;
    const checkInsert: IsNotNever<FollowUpQueueInsert> = true;
    const checkUpdate: IsNotNever<FollowUpQueueUpdate> = true;
    expect(check).toBe(true);
    expect(checkInsert).toBe(true);
    expect(checkUpdate).toBe(true);
  });

  it('practitioners Row includes qualification columns', () => {
    // Type-level check - if the field doesn't exist, this won't compile
    type PractRow = Database['public']['Tables']['practitioners']['Row'];
    type HasContactName = PractRow['contact_name'];
    type HasInterestLevel = PractRow['interest_level'];
    type HasRetryCount = PractRow['retry_count'];
    type HasDoNotCall = PractRow['do_not_call'];

    const check: IsNotNever<HasContactName> = true;
    const check2: IsNotNever<HasInterestLevel> = true;
    const check3: IsNotNever<HasRetryCount> = true;
    const check4: IsNotNever<HasDoNotCall> = true;
    expect(check && check2 && check3 && check4).toBe(true);
  });

  it('campaign_analytics Row includes extended columns', () => {
    type AnalyticsRow = Database['public']['Tables']['campaign_analytics']['Row'];
    type HasCallsAnswered = AnalyticsRow['calls_answered'];
    type HasConversionRate = AnalyticsRow['conversion_rate'];

    const check: IsNotNever<HasCallsAnswered> = true;
    const check2: IsNotNever<HasConversionRate> = true;
    expect(check && check2).toBe(true);
  });

  it('sample_requests Row includes confirmation columns', () => {
    type SampleRow = Database['public']['Tables']['sample_requests']['Row'];
    type HasConfirmationSent = SampleRow['confirmation_sent'];
    type HasConfirmationSentAt = SampleRow['confirmation_sent_at'];

    const check: IsNotNever<HasConfirmationSent> = true;
    const check2: IsNotNever<HasConfirmationSentAt> = true;
    expect(check && check2).toBe(true);
  });
});

describe('Type aliases', () => {
  it('CallStatus includes all expected values', () => {
    const statuses: CallStatus[] = [
      'not_called', 'queued', 'in_progress', 'completed',
      'booked', 'calendar_sent', 'failed', 'voicemail',
    ];
    expect(statuses).toHaveLength(8);
  });

  it('SampleStatus includes all expected values', () => {
    const statuses: SampleStatus[] = [
      'pending', 'approved', 'shipped', 'delivered', 'cancelled',
    ];
    expect(statuses).toHaveLength(5);
  });

  it('AppointmentStatus includes rescheduled', () => {
    const statuses: AppointmentStatus[] = [
      'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled',
    ];
    expect(statuses).toHaveLength(6);
  });

  it('AnalysisStatus includes all expected values', () => {
    const statuses: AnalysisStatus[] = [
      'pending', 'processing', 'completed', 'failed',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('InterestLevel includes all expected values', () => {
    const levels: InterestLevel[] = [
      'high', 'medium', 'low', 'not_interested',
    ];
    expect(levels).toHaveLength(4);
  });

  it('ContactRole includes all expected values', () => {
    const roles: ContactRole[] = [
      'owner', 'office_manager', 'receptionist', 'practitioner', 'other',
    ];
    expect(roles).toHaveLength(5);
  });

  it('FollowUpAction includes all expected values', () => {
    const actions: FollowUpAction[] = [
      'send_info', 'callback', 'sample', 'demo', 'none',
    ];
    expect(actions).toHaveLength(5);
  });

  it('RetryReason includes all expected values', () => {
    const reasons: RetryReason[] = [
      'voicemail_left', 'no_answer', 'call_failed', 'busy', 'manual_retry',
    ];
    expect(reasons).toHaveLength(5);
  });

  it('PathwaySuggestionType includes all expected values', () => {
    const types: PathwaySuggestionType[] = [
      'node_prompt', 'edge_label', 'missing_edge', 'missing_node', 'knowledge_base_gap',
    ];
    expect(types).toHaveLength(5);
  });
});
