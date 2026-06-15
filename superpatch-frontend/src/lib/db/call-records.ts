/**
 * Call Records Database Operations
 * 
 * CRUD operations for call_records table in Supabase
 */

import { supabase, supabaseAdmin, TypedSupabaseClient } from '../supabase';
import type { CallRecord, CallRecordInsert, CallRecordUpdate, CallStatus, CampaignStats } from './types';

// Fallback to localStorage if Supabase is not configured
import * as localStorage from '../campaign-storage';

/**
 * Returns the DB client to use for call_records operations.
 *
 * These functions run server-side (invoked from API routes that already
 * enforce requireApiAuth()). The anon client carries no user JWT, so under
 * is_active_user() RLS its reads return empty and writes fail. Prefer the
 * service-role admin client, falling back to anon only if the service key is
 * not configured (e.g. some local/test setups).
 */
function getDb(): TypedSupabaseClient | null {
  return supabaseAdmin ?? supabase;
}

/**
 * Get all call records
 */
export async function getAllCallRecords(): Promise<Record<string, CallRecord>> {
  const db = getDb();
  if (!db) {
    // Fallback to localStorage
    const records = localStorage.getCallRecords();
    return Object.fromEntries(
      Object.entries(records).map(([id, r]) => [id, convertLocalStorageRecord(r)])
    );
  }

  const { data, error } = await db
    .from('call_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch call records:', error);
    return {};
  }

  // Convert to record by practitioner_id
  return Object.fromEntries(
    (data || []).map((record: CallRecord) => [record.practitioner_id, record])
  );
}

/**
 * Get a single call record by practitioner ID
 */
export async function getCallRecord(practitionerId: string): Promise<CallRecord | null> {
  const db = getDb();
  if (!db) {
    const record = localStorage.getCallRecord(practitionerId);
    return record ? convertLocalStorageRecord(record) : null;
  }

  // A practitioner can have more than one call_records row (re-dials,
  // multiple campaigns). .single() throws when >1 row exists, so order by
  // recency and take the latest with .maybeSingle().
  const { data, error } = await db
    .from('call_records')
    .select('*')
    .eq('practitioner_id', practitionerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code !== 'PGRST116') { // Not found error
      console.error('Failed to fetch call record:', error);
    }
    return null;
  }

  return data as CallRecord | null;
}

/**
 * Get call record by Bland.ai call_id
 */
export async function getCallRecordByCallId(callId: string): Promise<CallRecord | null> {
  const db = getDb();
  if (!db) {
    const record = localStorage.getCallRecordByCallId(callId);
    return record ? convertLocalStorageRecord(record) : null;
  }

  const { data, error } = await db
    .from('call_records')
    .select('*')
    .eq('call_id', callId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Failed to fetch call record by call_id:', error);
    }
    return null;
  }

  return data as CallRecord;
}

/**
 * Create or update a call record (upsert)
 */
export async function upsertCallRecord(record: CallRecordInsert): Promise<CallRecord | null> {
  const db = getDb();
  if (!db) {
    // Fallback to localStorage
    const now = new Date().toISOString();
    // Generate a unique ID for unknown callers (when practitioner_id is null/undefined)
    const practitionerIdForStorage = record.practitioner_id || `unknown-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const localRecord: localStorage.CampaignCallRecord = {
      practitioner_id: practitionerIdForStorage,
      practitioner_name: record.practitioner_name,
      practitioner_type: record.practitioner_type || '',
      phone: record.phone,
      address: record.address || '',
      city: record.city || '',
      province: record.province || '',
      call_id: record.call_id || undefined,
      status: record.status || 'not_called',
      call_started_at: record.call_started_at || undefined,
      call_ended_at: record.call_ended_at || undefined,
      duration_seconds: record.duration_seconds || undefined,
      transcript: record.transcript || undefined,
      summary: record.summary || undefined,
      appointment_booked: record.appointment_booked || false,
      appointment_time: record.appointment_time || undefined,
      calendar_invite_sent: record.calendar_invite_sent || false,
      practitioner_email: record.practitioner_email || undefined,
      notes: record.notes || undefined,
      created_at: record.created_at || now,
      updated_at: now,
    };
    localStorage.saveCallRecord(localRecord);
    return convertLocalStorageRecord(localRecord);
  }

  // call_id has a unique constraint, practitioner_id does NOT
  // Use call_id for upsert when available, otherwise just insert
  if (record.call_id) {
    const { data, error } = await db
      .from('call_records')
      .upsert(record as any, { 
        onConflict: 'call_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (!error && data) {
      return data as CallRecord;
    }
    
    if (error) {
      console.error('Failed to upsert call record by call_id:', error);
    }
  }
  
  // No call_id or upsert failed - just insert a new record
  const { data, error } = await db
    .from('call_records')
    .insert(record as any)
    .select()
    .single();

  if (error) {
    console.error('Failed to insert call record:', error);
    return null;
  }

  return data as CallRecord;
}

/**
 * Update a call record
 */
export async function updateCallRecord(
  practitionerId: string, 
  updates: CallRecordUpdate
): Promise<CallRecord | null> {
  const db = getDb();
  if (!db) {
    const record = localStorage.getCallRecord(practitionerId);
    if (!record) return null;
    
    const updated = localStorage.updateCallStatus(
      practitionerId, 
      (updates.status as CallStatus) || record.status,
      updates as Partial<localStorage.CampaignCallRecord>
    );
    return updated ? convertLocalStorageRecord(updated) : null;
  }

  const { data, error } = await db
    .from('call_records')
    // @ts-expect-error - Supabase types need to be generated for full type safety
    .update(updates)
    .eq('practitioner_id', practitionerId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update call record:', error);
    return null;
  }

  return data as CallRecord;
}

/**
 * Update call status
 */
export async function updateCallStatus(
  practitionerId: string,
  status: CallStatus,
  additionalUpdates?: Partial<CallRecordUpdate>
): Promise<CallRecord | null> {
  const updates: CallRecordUpdate = {
    status,
    ...additionalUpdates,
  };

  // Set timestamps based on status
  if (status === 'in_progress') {
    updates.call_started_at = updates.call_started_at || new Date().toISOString();
  }
  
  if (['completed', 'booked', 'calendar_sent', 'failed'].includes(status)) {
    updates.call_ended_at = updates.call_ended_at || new Date().toISOString();
  }

  return updateCallRecord(practitionerId, updates);
}

/**
 * Get records by status
 */
export async function getRecordsByStatus(status: CallStatus): Promise<CallRecord[]> {
  const db = getDb();
  if (!db) {
    const records = localStorage.getRecordsByStatus(status);
    return records.map(convertLocalStorageRecord);
  }

  const { data, error } = await db
    .from('call_records')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch records by status:', error);
    return [];
  }

  return (data || []) as CallRecord[];
}

/**
 * Get campaign statistics
 */
export async function getCampaignStats(): Promise<CampaignStats> {
  const db = getDb();
  if (!db) {
    return localStorage.getCampaignStats();
  }

  const { data, error } = await db
    .from('call_records')
    .select('status, duration_seconds');

  if (error) {
    console.error('Failed to fetch campaign stats:', error);
    return {
      total_calls: 0,
      completed: 0,
      booked: 0,
      failed: 0,
      in_progress: 0,
      queued: 0,
      not_called: 0,
      calendar_sent: 0,
      voicemail: 0,
      total_duration_seconds: 0,
      avg_duration_seconds: 0,
      success_rate: 0,
      booking_rate: 0,
    };
  }

  const records = (data || []) as Array<{ status: CallStatus; duration_seconds: number | null }>;
  const stats: CampaignStats = {
    total_calls: records.length,
    completed: 0,
    booked: 0,
    failed: 0,
    in_progress: 0,
    queued: 0,
    not_called: 0,
    calendar_sent: 0,
    voicemail: 0,
    total_duration_seconds: 0,
    avg_duration_seconds: 0,
    success_rate: 0,
    booking_rate: 0,
  };

  let callsWithDuration = 0;

  for (const record of records) {
    switch (record.status) {
      case 'completed':
        stats.completed++;
        break;
      case 'booked':
        stats.booked++;
        break;
      case 'calendar_sent':
        stats.calendar_sent++;
        stats.booked++; // Also count as booked
        break;
      case 'voicemail':
        stats.voicemail++;
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'in_progress':
        stats.in_progress++;
        break;
      case 'queued':
        stats.queued++;
        break;
      case 'not_called':
        stats.not_called++;
        break;
    }

    if (record.duration_seconds) {
      stats.total_duration_seconds += record.duration_seconds;
      callsWithDuration++;
    }
  }

  const completedCalls = stats.completed + stats.booked + stats.calendar_sent;
  const totalAttempted = completedCalls + stats.failed;

  stats.success_rate = totalAttempted > 0 ? (completedCalls / totalAttempted) * 100 : 0;
  stats.booking_rate = completedCalls > 0 ? ((stats.booked + stats.calendar_sent) / completedCalls) * 100 : 0;
  stats.avg_duration_seconds = callsWithDuration > 0 ? Math.round(stats.total_duration_seconds / callsWithDuration) : 0;

  return stats;
}

/**
 * Delete a call record
 */
export async function deleteCallRecord(practitionerId: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    // No delete in localStorage implementation, but we can clear it
    return false;
  }

  const { error } = await db
    .from('call_records')
    .delete()
    .eq('practitioner_id', practitionerId);

  if (error) {
    console.error('Failed to delete call record:', error);
    return false;
  }

  return true;
}

/**
 * Clear all call records
 */
export async function clearAllRecords(): Promise<void> {
  const db = getDb();
  if (!db) {
    localStorage.clearAllRecords();
    return;
  }

  const { error } = await db
    .from('call_records')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (error) {
    console.error('Failed to clear call records:', error);
  }
}

/**
 * Server-side upsert using admin client (for webhooks)
 */
export async function serverUpsertCallRecord(record: CallRecordInsert): Promise<CallRecord | null> {
  const client = supabaseAdmin || supabase;
  
  if (!client) {
    console.error('No Supabase client available for server operation');
    return null;
  }

  // Strategy: 
  // 1. If we have a call_id, try to upsert by call_id (unique constraint)
  // 2. If we have practitioner_id, try to upsert by practitioner_id
  // 3. Otherwise, just insert a new record

  // Try by call_id first (most reliable for webhooks)
  if (record.call_id) {
    console.log('📝 Upserting by call_id:', record.call_id);
    const { data, error } = await client
      .from('call_records')
      .upsert(record as any, { 
        onConflict: 'call_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (!error && data) {
      return data as CallRecord;
    }
    
    // If call_id upsert failed, log and continue
    if (error) {
      console.warn('call_id upsert failed, trying alternative:', error.message);
    }
  }

  // Note: practitioner_id does NOT have a unique constraint, so we can't upsert by it
  // Just insert a new record instead
  console.log('📝 Inserting new record (no unique key match)');
  const { data, error } = await client
    .from('call_records')
    .insert(record as any)
    .select()
    .single();

  if (error) {
    console.error('Failed to insert call record:', error);
    return null;
  }

  return data as CallRecord;
}

/**
 * Server-side update by call_id (for webhooks)
 */
export async function serverUpdateByCallId(
  callId: string, 
  updates: CallRecordUpdate
): Promise<CallRecord | null> {
  const client = supabaseAdmin || supabase;
  
  if (!client) {
    console.error('No Supabase client available for server operation');
    return null;
  }

  const { data, error } = await client
    .from('call_records')
    // @ts-expect-error - Supabase types need to be generated for full type safety
    .update(updates)
    .eq('call_id', callId)
    .select()
    .single();

  if (error) {
    console.error('Failed to server update call record:', error);
    return null;
  }

  return data as CallRecord;
}

// Helper to convert localStorage record to database record format
function convertLocalStorageRecord(record: localStorage.CampaignCallRecord): CallRecord {
  return {
    id: record.practitioner_id, // Use practitioner_id as id for compatibility
    practitioner_id: record.practitioner_id,
    practitioner_name: record.practitioner_name,
    practitioner_type: record.practitioner_type,
    phone: record.phone,
    address: record.address,
    city: record.city,
    province: record.province,
    call_id: record.call_id || null,
    status: record.status,
    call_started_at: record.call_started_at || null,
    call_ended_at: record.call_ended_at || null,
    duration_seconds: record.duration_seconds || null,
    transcript: record.transcript || null,
    summary: record.summary || null,
    appointment_booked: record.appointment_booked,
    appointment_time: record.appointment_time || null,
    calendar_invite_sent: record.calendar_invite_sent,
    practitioner_email: record.practitioner_email || null,
    booking_id: null,
    notes: record.notes || null,
    sentiment_score: null,
    sentiment_label: null,
    recording_url: null,
    lead_score: 0,
    // LLM Analysis fields (not available in localStorage)
    llm_analysis: null,
    llm_lead_score: null,
    llm_analyzed_at: null,
    analysis_status: null,
    // Idempotency marker (server-only; localStorage records are pre-server-state)
    processed_at: null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}
