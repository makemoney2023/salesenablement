/**
 * Campaign Storage - localStorage wrapper for call record management
 * 
 * Stores call records, campaign state, and practitioner call history
 */

export type CallStatus = 
  | 'not_called' 
  | 'queued' 
  | 'in_progress' 
  | 'completed' 
  | 'booked' 
  | 'calendar_sent' 
  | 'failed'
  | 'voicemail';

export interface CampaignCallRecord {
  practitioner_id: string;
  practitioner_name: string;
  practitioner_type: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  call_id?: string;
  status: CallStatus;
  call_started_at?: string;
  call_ended_at?: string;
  duration_seconds?: number;
  transcript?: string;
  summary?: string;
  appointment_booked: boolean;
  appointment_time?: string;
  calendar_invite_sent: boolean;
  practitioner_email?: string;
  notes?: string;
  // Call intelligence fields
  sentiment_label?: string;
  sentiment_score?: number;
  lead_score?: number;
  recording_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  total_calls: number;
  completed: number;
  booked: number;
  failed: number;
  in_progress: number;
  queued: number;
  not_called: number;
  calendar_sent: number;
  voicemail: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  success_rate: number;
  booking_rate: number;
}

const STORAGE_KEY = 'superpatch_campaign_calls';
const CAMPAIGN_STATE_KEY = 'superpatch_campaign_state';

// Helper to check if we're in browser
const isBrowser = typeof window !== 'undefined';

/**
 * Get all call records from storage
 */
export function getCallRecords(): Record<string, CampaignCallRecord> {
  if (!isBrowser) return {};
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load call records:', error);
    return {};
  }
}

/**
 * Get a single call record by practitioner ID
 */
export function getCallRecord(practitionerId: string): CampaignCallRecord | null {
  const records = getCallRecords();
  return records[practitionerId] || null;
}

/**
 * Get call record by Bland.ai call_id
 */
export function getCallRecordByCallId(callId: string): CampaignCallRecord | null {
  const records = getCallRecords();
  return Object.values(records).find(r => r.call_id === callId) || null;
}

/**
 * Save or update a call record
 */
export function saveCallRecord(record: CampaignCallRecord): void {
  if (!isBrowser) return;
  
  const records = getCallRecords();
  records[record.practitioner_id] = {
    ...record,
    updated_at: new Date().toISOString(),
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Failed to save call record:', error);
  }
}

/**
 * Create a new call record for a practitioner.
 * Saves to localStorage immediately and syncs to Supabase via API.
 * 
 * @param practitioner - Practitioner data including optional call_id from Bland.ai
 * @returns The created call record
 */
export function createCallRecord(practitioner: {
  id: string;
  name: string;
  practitioner_type: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  call_id?: string;  // Bland.ai call_id - critical for webhook to find this record
}): CampaignCallRecord {
  const now = new Date().toISOString();
  
  // Determine initial status based on whether call_id is present
  // If we have a call_id, the call has been initiated
  const initialStatus: CallStatus = practitioner.call_id ? 'in_progress' : 'not_called';
  
  const record: CampaignCallRecord = {
    practitioner_id: practitioner.id,
    practitioner_name: practitioner.name,
    practitioner_type: practitioner.practitioner_type,
    phone: practitioner.phone,
    address: practitioner.address,
    city: practitioner.city,
    province: practitioner.province,
    call_id: practitioner.call_id,  // Save call_id so webhook can find this record
    status: initialStatus,
    call_started_at: practitioner.call_id ? now : undefined,  // Set start time if call initiated
    appointment_booked: false,
    calendar_invite_sent: false,
    created_at: now,
    updated_at: now,
  };
  
  // Save to localStorage for immediate UI update
  saveCallRecord(record);
  
  // Also sync to Supabase via API (fire and forget for batch campaigns)
  if (isBrowser) {
    syncCallRecordToSupabase(record).catch(err =>
      console.warn('Failed to sync call record to Supabase:', err)
    );
  }
  
  return record;
}

/**
 * Sync a call record to Supabase. Exported so callers can await it
 * when they need the record to exist before refreshing the UI
 * (e.g. quick calls need the record in Supabase for the live queue).
 */
export async function syncCallRecordToSupabase(
  record: CampaignCallRecord
): Promise<boolean> {
  try {
    const response = await fetch('/api/campaign/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practitioner_id: record.practitioner_id,
        practitioner_name: record.practitioner_name,
        practitioner_type: record.practitioner_type,
        phone: record.phone,
        address: record.address,
        city: record.city,
        province: record.province,
        call_id: record.call_id,
        status: record.status,
        call_started_at: record.call_started_at,
      }),
    });
    return response.ok;
  } catch (err) {
    console.warn('Failed to sync call record to Supabase:', err);
    return false;
  }
}

/**
 * Update call status
 */
export function updateCallStatus(
  practitionerId: string, 
  status: CallStatus, 
  updates?: Partial<CampaignCallRecord>
): CampaignCallRecord | null {
  if (!isBrowser) return null;

  // Read all records once to avoid stale data between separate read/write calls
  const records = getCallRecords();
  const record = records[practitionerId];
  if (!record) return null;
  
  const updated: CampaignCallRecord = {
    ...record,
    ...updates,
    status,
    updated_at: new Date().toISOString(),
  };
  
  // Set timestamps based on status
  if (status === 'in_progress' && !updated.call_started_at) {
    updated.call_started_at = new Date().toISOString();
  }
  
  if (['completed', 'booked', 'calendar_sent', 'failed'].includes(status) && !updated.call_ended_at) {
    updated.call_ended_at = new Date().toISOString();
  }
  
  // Write back atomically using the same records object
  records[practitionerId] = updated;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Failed to save updated call status:', error);
  }
  
  return updated;
}

/**
 * Update call record from webhook data
 */
export function updateFromWebhook(
  callId: string,
  webhookData: {
    status?: string;
    call_length?: number;
    concatenated_transcript?: string;
    variables?: Record<string, string | undefined>;
    analysis?: {
      summary?: string;
    };
  }
): CampaignCallRecord | null {
  const record = getCallRecordByCallId(callId);
  if (!record) return null;
  
  const vars = webhookData.variables || {};
  
  // Determine status based on webhook data
  let status: CallStatus = 'completed';
  if (vars.wants_demo === 'true' || vars.appointment_time) {
    status = 'booked';
  }
  if (vars.schedule_demo === 'true' && vars.practitioner_email) {
    status = 'calendar_sent';
  }
  if (webhookData.status === 'failed' || webhookData.status === 'no-answer') {
    status = 'failed';
  }
  
  const updated: CampaignCallRecord = {
    ...record,
    status,
    duration_seconds: webhookData.call_length,
    transcript: webhookData.concatenated_transcript,
    summary: webhookData.analysis?.summary,
    appointment_booked: status === 'booked' || status === 'calendar_sent',
    appointment_time: vars.appointment_time,
    practitioner_email: vars.practitioner_email || vars.email,
    calendar_invite_sent: status === 'calendar_sent',
    call_ended_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  saveCallRecord(updated);
  return updated;
}

/**
 * Get all records with a specific status
 */
export function getRecordsByStatus(status: CallStatus): CampaignCallRecord[] {
  const records = getCallRecords();
  return Object.values(records).filter(r => r.status === status);
}

/**
 * Get campaign statistics
 */
export function getCampaignStats(): CampaignStats {
  const records = Object.values(getCallRecords());

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
 * Clear all call records
 */
export function clearAllRecords(): void {
  if (!isBrowser) return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export records as JSON
 * First tries to fetch from Supabase API, falls back to localStorage
 */
export async function exportRecordsAsync(): Promise<string> {
  try {
    const response = await fetch('/api/campaign/calls');
    if (response.ok) {
      const data = await response.json();
      const records = Object.values(data.records || {});
      
      // Calculate stats
      const stats = getCampaignStats(); // Use localStorage stats for now
      
      return JSON.stringify({
        exported_at: new Date().toISOString(),
        stats,
        records,
        source: 'supabase',
      }, null, 2);
    }
  } catch (err) {
    console.warn('Failed to export from Supabase, using localStorage:', err);
  }
  
  // Fallback to localStorage
  return exportRecords();
}

/**
 * Export records as JSON (synchronous, localStorage only)
 */
export function exportRecords(): string {
  const records = getCallRecords();
  const stats = getCampaignStats();
  
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    stats,
    records: Object.values(records),
    source: 'localStorage',
  }, null, 2);
}

/**
 * Import records from JSON
 */
export function importRecords(json: string): number {
  try {
    const data = JSON.parse(json);
    const records = Array.isArray(data.records) ? data.records : Object.values(data);
    
    let imported = 0;
    for (const record of records) {
      if (record.practitioner_id) {
        saveCallRecord(record as CampaignCallRecord);
        imported++;
      }
    }
    
    return imported;
  } catch (error) {
    console.error('Failed to import records:', error);
    return 0;
  }
}

/**
 * Reconcile stale in_progress records that were never updated by the webhook.
 *
 * This can happen when:
 *   - The webhook fails or times out
 *   - The browser is closed before the webhook fires
 *   - The Bland.ai call fails silently
 *
 * Records stuck as "in_progress" for longer than `maxAgeMinutes` are either
 * refreshed from Supabase (if available) or marked as "failed" locally.
 *
 * Call this on page load / tab focus to keep the UI accurate.
 */
export async function reconcileStaleInProgressRecords(
  maxAgeMinutes = 20
): Promise<{ reconciled: number; ids: string[] }> {
  if (!isBrowser) return { reconciled: 0, ids: [] };

  const records = getCallRecords();
  const now = Date.now();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  const staleIds: string[] = [];

  for (const record of Object.values(records)) {
    if (record.status !== 'in_progress') continue;

    const startedAt = record.call_started_at
      ? new Date(record.call_started_at).getTime()
      : new Date(record.created_at).getTime();

    if (now - startedAt > maxAgeMs) {
      staleIds.push(record.practitioner_id);
    }
  }

  if (staleIds.length === 0) return { reconciled: 0, ids: [] };

  console.warn(`[campaign-storage] Found ${staleIds.length} stale in_progress records, reconciling...`);

  let reconciled = 0;
  for (const id of staleIds) {
    const record = records[id];
    if (!record?.call_id) {
      // No call_id — can't check Supabase, mark as failed
      updateCallStatus(id, 'failed', {
        notes: 'Auto-marked as failed: stuck in_progress with no call_id',
      });
      reconciled++;
      continue;
    }

    // Try to fetch the real status from Supabase
    try {
      const response = await fetch(`/api/campaign/calls?call_id=${encodeURIComponent(record.call_id)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.record && data.found) {
          // Supabase has the real status — update localStorage to match
          const serverRecord = data.record;
          updateCallStatus(id, serverRecord.status, {
            call_ended_at: serverRecord.call_ended_at,
            duration_seconds: serverRecord.duration_seconds,
            transcript: serverRecord.transcript,
            summary: serverRecord.summary,
            appointment_booked: serverRecord.appointment_booked,
            appointment_time: serverRecord.appointment_time,
            practitioner_email: serverRecord.practitioner_email,
            sentiment_label: serverRecord.sentiment_label,
            sentiment_score: serverRecord.sentiment_score,
            lead_score: serverRecord.lead_score,
            recording_url: serverRecord.recording_url,
          });
          reconciled++;
          continue;
        }
      }
    } catch (err) {
      console.warn(`[campaign-storage] Failed to check Supabase for call ${record.call_id}:`, err);
    }

    // Supabase check failed or record not found — mark as failed
    updateCallStatus(id, 'failed', {
      notes: 'Auto-marked as failed: stuck in_progress for over 20 minutes',
    });
    reconciled++;
  }

  console.log(`[campaign-storage] Reconciled ${reconciled} stale records: [${staleIds.join(', ')}]`);
  return { reconciled, ids: staleIds };
}

// Campaign queue state management
export interface CampaignQueueState {
  is_running: boolean;
  current_call_id?: string;
  current_practitioner_id?: string;
  queued_practitioner_ids: string[];
  delay_between_calls_ms: number;
  max_concurrent_calls: number;
  started_at?: string;
  paused_at?: string;
}

const DEFAULT_QUEUE_STATE: CampaignQueueState = {
  is_running: false,
  queued_practitioner_ids: [],
  delay_between_calls_ms: 60000, // 1 minute
  max_concurrent_calls: 1,
};

export function getCampaignQueueState(): CampaignQueueState {
  if (!isBrowser) return DEFAULT_QUEUE_STATE;
  
  try {
    const data = localStorage.getItem(CAMPAIGN_STATE_KEY);
    return data ? { ...DEFAULT_QUEUE_STATE, ...JSON.parse(data) } : DEFAULT_QUEUE_STATE;
  } catch {
    return DEFAULT_QUEUE_STATE;
  }
}

export function saveCampaignQueueState(state: Partial<CampaignQueueState>): void {
  if (!isBrowser) return;
  
  const current = getCampaignQueueState();
  const updated = { ...current, ...state };
  
  try {
    localStorage.setItem(CAMPAIGN_STATE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save campaign state:', error);
  }
}

export function addToQueue(practitionerIds: string[]): void {
  const state = getCampaignQueueState();
  const newIds = practitionerIds.filter(id => !state.queued_practitioner_ids.includes(id));
  
  saveCampaignQueueState({
    queued_practitioner_ids: [...state.queued_practitioner_ids, ...newIds],
  });
  
  // Update status for queued practitioners
  for (const id of newIds) {
    const record = getCallRecord(id);
    if (record && record.status === 'not_called') {
      updateCallStatus(id, 'queued');
    }
  }
}

export function removeFromQueue(practitionerId: string): void {
  const state = getCampaignQueueState();
  saveCampaignQueueState({
    queued_practitioner_ids: state.queued_practitioner_ids.filter(id => id !== practitionerId),
  });
}

export function clearQueue(): void {
  const state = getCampaignQueueState();
  
  // Reset status for queued practitioners
  for (const id of state.queued_practitioner_ids) {
    const record = getCallRecord(id);
    if (record && record.status === 'queued') {
      updateCallStatus(id, 'not_called');
    }
  }
  
  saveCampaignQueueState({
    is_running: false,
    queued_practitioner_ids: [],
    current_call_id: undefined,
    current_practitioner_id: undefined,
  });
}
