/**
 * Batch Caller - Queue management for campaign calls
 * 
 * Handles sequential calling with rate limiting and status tracking
 */

import {
  createCallRecord,
  getCallRecord,
  updateCallStatus,
  getCampaignQueueState,
  saveCampaignQueueState,
  removeFromQueue,
} from './campaign-storage';
import {
  KB_ID,
  VOICE_ID,
  WEBHOOK_URL,
  getPathwayId as getPathwayIdFromConfig,
} from './config/pathways';
// Bland Memory Store ID for cross-call context retention
const MEMORY_ID = process.env.NEXT_PUBLIC_BLAND_MEMORY_ID || "";

export interface Practitioner {
  id: string;
  name: string;
  practitioner_type: string;
  address: string;
  city: string;
  province: string;
  phone: string | null;
  website?: string | null;
  rating?: number | null;
  review_count?: number | null;
  is_user_added?: boolean;
  // Do Not Call fields
  do_not_call?: boolean;
  dnc_reason?: string | null;
  dnc_detected_at?: string | null;
  dnc_source?: 'ai_detected' | 'manual' | null;
  // Contact info (from qualification or enrichment)
  contact_email?: string | null;
  postal_code?: string | null;
  // Enrichment data (optional)
  enrichment?: {
    success?: boolean;
    data?: {
      emails?: string[];
      phones?: string[];
      [key: string]: unknown;
    };
  } | null;
}

export interface CallResult {
  success: boolean;
  call_id?: string;
  error?: string;
  practitioner_id: string;
}

export type BatchCallerEventType = 
  | 'call_started'
  | 'call_completed'
  | 'call_failed'
  | 'queue_empty'
  | 'campaign_paused'
  | 'campaign_stopped';

export interface BatchCallerEvent {
  type: BatchCallerEventType;
  practitioner_id?: string;
  call_id?: string;
  error?: string;
  remaining?: number;
}

type EventListener = (event: BatchCallerEvent) => void;

/**
 * Get pathway ID for a practitioner type.
 * Delegates to shared config in lib/config/pathways.ts.
 */
function getPathwayId(practitionerType: string): string {
  return getPathwayIdFromConfig(practitionerType);
}

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX for North American numbers).
 * Rejects numbers that don't match expected format instead of silently truncating.
 */
function formatPhoneNumber(phone: string): string | null {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    // Standard 10-digit North American number
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // 11-digit with country code 1
    return `+${digits}`;
  }
  
  // Reject numbers that don't match expected North American format
  // (previously silently truncated, which could call wrong numbers)
  return null;
}

/**
 * BatchCaller class - manages campaign call queue
 */
export class BatchCaller {
  private isRunning = false;
  private isPaused = false;
  private currentCallId: string | null = null;
  private currentPractitionerId: string | null = null;
  private delayBetweenCalls = 60000; // 1 minute default
  private listeners: EventListener[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Restore state from storage
    const state = getCampaignQueueState();
    this.isRunning = state.is_running;
    this.delayBetweenCalls = state.delay_between_calls_ms;
    this.currentCallId = state.current_call_id || null;
    this.currentPractitionerId = state.current_practitioner_id || null;
  }

  /**
   * Subscribe to batch caller events
   */
  subscribe(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: BatchCallerEvent) {
    this.listeners.forEach(l => l(event));
  }

  /**
   * Set delay between calls (in milliseconds)
   */
  setDelayBetweenCalls(ms: number) {
    this.delayBetweenCalls = ms;
    saveCampaignQueueState({ delay_between_calls_ms: ms });
  }

  /**
   * Make a single call to a practitioner
   */
  async makeCall(practitioner: Practitioner): Promise<CallResult> {
    const phone = formatPhoneNumber(practitioner.phone || '');
    
    if (!phone) {
      return {
        success: false,
        error: 'Invalid phone number',
        practitioner_id: practitioner.id,
      };
    }

    // Ensure we have a call record
    let record = getCallRecord(practitioner.id);
    if (!record) {
      record = createCallRecord({
        id: practitioner.id,
        name: practitioner.name,
        practitioner_type: practitioner.practitioner_type,
        phone: practitioner.phone || '',
        address: practitioner.address,
        city: practitioner.city,
        province: practitioner.province,
      });
    }

    // Get best available email from practitioner data
    const practitionerEmail = practitioner.contact_email || 
      (practitioner.enrichment?.data?.emails?.[0]) || '';

    // Build request_data with practice context
    const requestData = {
      practice_name: practitioner.name || 'your practice',
      practice_address: practitioner.address || '',
      practice_city: practitioner.city || '',
      practice_province: practitioner.province || '',
      practice_postal_code: practitioner.postal_code || '',
      practice_email: practitionerEmail,
      google_rating: practitioner.rating?.toString() || '',
      review_count: practitioner.review_count?.toString() || '',
      website: practitioner.website || '',
      practitioner_type: practitioner.practitioner_type || '',
      has_address: practitioner.address ? 'true' : 'false',
      has_email: practitionerEmail ? 'true' : 'false',
      // For greeting personalization in pathway
      greeting_name: practitioner.name || 'there',
    };

    const pathwayId = getPathwayId(practitioner.practitioner_type);

    // From number for outbound calls (optional - Bland uses default if not set)
    const fromNumber = process.env.NEXT_PUBLIC_BLAND_FROM_NUMBER || process.env.BLAND_FROM_NUMBER;

    const callPayload: Record<string, unknown> = {
      phone_number: phone,
      pathway_id: pathwayId,
      // Don't specify pathway_version - uses production version by default
      knowledge_base: KB_ID,
      voice: VOICE_ID,
      // Don't use first_sentence with pathways - let the pathway handle the intro
      wait_for_greeting: true,
      record: true,
      max_duration: 15, // minutes — Bland.ai max_duration is in minutes (15 min cap per call)
      webhook: WEBHOOK_URL,
      request_data: requestData,
      // Include from number if configured
      ...(fromNumber && { from: fromNumber }),
      metadata: {
        campaign: 'canadian_practitioners',
        source: 'campaign_dialer',
        practitioner_id: practitioner.id,
        practice_name: practitioner.name,
        practitioner_type: practitioner.practitioner_type,
        // Include full address info for webhook processing
        address: practitioner.address || '',
        city: practitioner.city || '',
        province: practitioner.province || '',
        postal_code: practitioner.postal_code || '',
        // Include email for sample requests and appointment booking
        // Priority: contact_email > enrichment emails
        clinic_email: practitioner.contact_email || 
          (practitioner.enrichment?.data?.emails?.[0]) || '',
      },
    };

    // Add memory_id for cross-call context retention (if configured)
    if (MEMORY_ID) {
      callPayload.memory_id = MEMORY_ID.trim();
    }

    try {
      const response = await fetch('/api/bland/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callPayload),
      });

      const result = await response.json();

      if (result.status === 'success' && result.call_id) {
        // Update record with call_id and status
        updateCallStatus(practitioner.id, 'in_progress', {
          call_id: result.call_id,
          call_started_at: new Date().toISOString(),
        });

        return {
          success: true,
          call_id: result.call_id,
          practitioner_id: practitioner.id,
        };
      } else {
        updateCallStatus(practitioner.id, 'failed', {
          notes: result.message || 'Call initiation failed',
        });

        return {
          success: false,
          error: result.message || 'Call initiation failed',
          practitioner_id: practitioner.id,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      updateCallStatus(practitioner.id, 'failed', {
        notes: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        practitioner_id: practitioner.id,
      };
    }
  }

  /**
   * Start the campaign queue
   */
  async startCampaign(practitioners: Practitioner[]): Promise<void> {
    if (this.isRunning) {
      console.log('Campaign already running');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;

    saveCampaignQueueState({
      is_running: true,
      started_at: new Date().toISOString(),
    });

    // Ensure all practitioners have call records and are queued
    for (const practitioner of practitioners) {
      let record = getCallRecord(practitioner.id);
      if (!record) {
        record = createCallRecord({
          id: practitioner.id,
          name: practitioner.name,
          practitioner_type: practitioner.practitioner_type,
          phone: practitioner.phone || '',
          address: practitioner.address,
          city: practitioner.city,
          province: practitioner.province,
        });
      }
      if (record.status === 'not_called') {
        updateCallStatus(practitioner.id, 'queued');
      }
    }

    // Start processing queue
    await this.processQueue(practitioners);
  }

  /**
   * Process the call queue
   */
  private async processQueue(practitioners: Practitioner[]): Promise<void> {
    for (let i = 0; i < practitioners.length; i++) {
      if (!this.isRunning || this.isPaused) {
        break;
      }

      const practitioner = practitioners[i];
      const record = getCallRecord(practitioner.id);

      // Skip if already called or no phone
      if (record && record.status !== 'queued' && record.status !== 'not_called') {
        continue;
      }

      if (!practitioner.phone) {
        continue;
      }

      this.currentPractitionerId = practitioner.id;
      saveCampaignQueueState({ current_practitioner_id: practitioner.id });

      // Make the call
      const result = await this.makeCall(practitioner);

      if (result.success) {
        this.currentCallId = result.call_id || null;
        saveCampaignQueueState({ current_call_id: result.call_id });

        this.emit({
          type: 'call_started',
          practitioner_id: practitioner.id,
          call_id: result.call_id,
          remaining: practitioners.length - i - 1,
        });

        // Wait for call to complete (poll status)
        await this.waitForCallCompletion(result.call_id!);

        this.emit({
          type: 'call_completed',
          practitioner_id: practitioner.id,
          call_id: result.call_id,
          remaining: practitioners.length - i - 1,
        });
      } else {
        this.emit({
          type: 'call_failed',
          practitioner_id: practitioner.id,
          error: result.error,
          remaining: practitioners.length - i - 1,
        });
      }

      // Remove from queue
      removeFromQueue(practitioner.id);

      // Delay before next call (unless last one)
      if (i < practitioners.length - 1 && this.isRunning && !this.isPaused) {
        await this.delay(this.delayBetweenCalls);
      }
    }

    // Campaign finished
    this.isRunning = false;
    this.currentCallId = null;
    this.currentPractitionerId = null;

    saveCampaignQueueState({
      is_running: false,
      current_call_id: undefined,
      current_practitioner_id: undefined,
    });

    this.emit({ type: 'queue_empty' });
  }

  /**
   * Wait for a call to complete by polling its status.
   * Uses exponential backoff on errors and stops after max consecutive failures.
   */
  private async waitForCallCompletion(callId: string, maxWaitMs = 900000): Promise<void> {
    const startTime = Date.now();
    const basePollIntervalMs = 5000; // Poll every 5 seconds
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5; // Stop polling after 5 consecutive errors

    while (Date.now() - startTime < maxWaitMs) {
      if (!this.isRunning || this.isPaused) {
        break;
      }

      try {
        const response = await fetch(`/api/bland/calls/${callId}`);
        
        if (!response.ok) {
          consecutiveErrors++;
          console.warn(`Bland.ai poll error (${consecutiveErrors}/${maxConsecutiveErrors}):`, response.status);
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error(`Max polling errors reached for call ${callId} — stopping poll`);
            return;
          }
          // Exponential backoff on errors
          await this.delay(basePollIntervalMs * Math.pow(2, consecutiveErrors - 1));
          continue;
        }
        
        const callData = await response.json();
        consecutiveErrors = 0; // Reset on success

        if (callData.status === 'completed' || callData.status === 'failed' || callData.status === 'no-answer') {
          // Update local record with call data
          const record = getCallRecord(this.currentPractitionerId!);
          if (record) {
            let status: 'completed' | 'booked' | 'failed' = 'completed';
            
            // Handle both string and boolean values from Bland variables
            if (callData.status === 'failed' || callData.status === 'no-answer') {
              status = 'failed';
            } else if (
              String(callData.variables?.wants_demo).toLowerCase() === 'true' || 
              callData.variables?.wants_demo === true || 
              callData.variables?.appointment_time
            ) {
              status = 'booked';
            }

            updateCallStatus(record.practitioner_id, status, {
              duration_seconds: callData.call_length,
              transcript: callData.concatenated_transcript,
              call_ended_at: new Date().toISOString(),
            });
          }
          
          return;
        }
      } catch (error) {
        consecutiveErrors++;
        console.error(`Error polling call status (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error(`Max polling errors reached for call ${callId} — stopping poll`);
          return;
        }
      }

      await this.delay(basePollIntervalMs);
    }
  }

  /**
   * Pause the campaign
   */
  pauseCampaign(): void {
    this.isPaused = true;
    saveCampaignQueueState({
      paused_at: new Date().toISOString(),
    });
    this.emit({ type: 'campaign_paused' });
  }

  /**
   * Resume the campaign
   */
  resumeCampaign(practitioners: Practitioner[]): void {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    saveCampaignQueueState({ paused_at: undefined });
    
    // Continue processing from where we left off
    const remaining = practitioners.filter(p => {
      const record = getCallRecord(p.id);
      return !record || record.status === 'queued' || record.status === 'not_called';
    });
    
    this.processQueue(remaining);
  }

  /**
   * Stop the campaign completely
   */
  stopCampaign(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.currentCallId = null;
    this.currentPractitionerId = null;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    saveCampaignQueueState({
      is_running: false,
      current_call_id: undefined,
      current_practitioner_id: undefined,
    });

    this.emit({ type: 'campaign_stopped' });
  }

  /**
   * Get current campaign state
   */
  getState() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentCallId: this.currentCallId,
      currentPractitionerId: this.currentPractitionerId,
      delayBetweenCalls: this.delayBetweenCalls,
    };
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let batchCallerInstance: BatchCaller | null = null;

export function getBatchCaller(): BatchCaller {
  if (!batchCallerInstance) {
    batchCallerInstance = new BatchCaller();
  }
  return batchCallerInstance;
}
