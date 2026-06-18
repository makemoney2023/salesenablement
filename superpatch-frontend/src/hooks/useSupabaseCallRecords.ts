"use client";

/**
 * Hook for managing call records with Supabase realtime updates
 * 
 * Features:
 * - Fetches call records from Supabase
 * - Subscribes to realtime updates
 * - Falls back to API polling if realtime fails
 * - Provides campaign statistics
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import type { CallRecord, CallStatus, CampaignStats } from "@/lib/db/types";

// Normalized call record type (no null values, for UI compatibility)
export interface NormalizedCallRecord {
  id: string;
  practitioner_id: string;  // Will use record.id as fallback for unknown callers
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
  booking_id?: string;
  notes?: string;
  // Call intelligence fields
  sentiment_label?: string;
  sentiment_score?: number;
  lead_score?: number;
  recording_url?: string;
  created_at: string;
  updated_at: string;
  is_unknown_caller?: boolean;  // Flag to identify calls from unknown numbers
}

// Normalize a CallRecord by converting nulls to empty strings/undefined
function normalizeRecord(record: CallRecord): NormalizedCallRecord {
  // For unknown callers (practitioner_id is null), use the record's id as the key
  const isUnknownCaller = !record.practitioner_id;
  
  return {
    id: record.id,
    practitioner_id: record.practitioner_id || record.id,  // Fallback to record ID for unknown callers
    practitioner_name: record.practitioner_name || 'Unknown Caller',
    practitioner_type: record.practitioner_type || 'Unknown',
    phone: record.phone,
    address: record.address || '',
    city: record.city || '',
    province: record.province || '',
    call_id: record.call_id || undefined,
    status: record.status,
    call_started_at: record.call_started_at || undefined,
    call_ended_at: record.call_ended_at || undefined,
    duration_seconds: record.duration_seconds || undefined,
    transcript: record.transcript || undefined,
    summary: record.summary || undefined,
    appointment_booked: record.appointment_booked,
    appointment_time: record.appointment_time || undefined,
    calendar_invite_sent: record.calendar_invite_sent,
    practitioner_email: record.practitioner_email || undefined,
    booking_id: record.booking_id || undefined,
    notes: record.notes || undefined,
    // Call intelligence fields
    sentiment_label: record.sentiment_label || undefined,
    sentiment_score: record.sentiment_score || undefined,
    lead_score: record.lead_score || 0,
    recording_url: record.recording_url || undefined,
    created_at: record.created_at,
    updated_at: record.updated_at,
    is_unknown_caller: isUnknownCaller,
  };
}

// Convert to Record keyed by practitioner_id
type CallRecordsMap = Record<string, NormalizedCallRecord>;

interface UseSupabaseCallRecordsResult {
  records: CallRecordsMap;
  recordsArray: NormalizedCallRecord[];
  stats: CampaignStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
}

// Calculate stats from records
function calculateStats(records: NormalizedCallRecord[]): CampaignStats {
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
    // Count by status
    switch (record.status) {
      case "completed":
        stats.completed++;
        break;
      case "booked":
        stats.booked++;
        break;
      case "failed":
        stats.failed++;
        break;
      case "in_progress":
        stats.in_progress++;
        break;
      case "queued":
        stats.queued++;
        break;
      case "not_called":
        stats.not_called++;
        break;
      case "calendar_sent":
        stats.calendar_sent++;
        break;
      case "voicemail":
        stats.voicemail++;
        break;
    }

    // Sum duration
    if (record.duration_seconds) {
      stats.total_duration_seconds += record.duration_seconds;
      callsWithDuration++;
    }
  }

  // Calculate averages and rates
  if (callsWithDuration > 0) {
    stats.avg_duration_seconds = Math.round(stats.total_duration_seconds / callsWithDuration);
  }

  const totalAttempted = stats.completed + stats.booked + stats.calendar_sent + stats.failed + stats.voicemail;
  if (totalAttempted > 0) {
    stats.success_rate = Math.round(
      ((stats.completed + stats.booked + stats.calendar_sent) / totalAttempted) * 100
    );
    stats.booking_rate = Math.round(
      ((stats.booked + stats.calendar_sent) / totalAttempted) * 100
    );
  }

  return stats;
}

export function useSupabaseCallRecords(): UseSupabaseCallRecordsResult {
  const supabase = getBrowserSupabase();
  const [records, setRecords] = useState<CallRecordsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all records from API
  const fetchRecords = useCallback(async () => {
    try {
      const response = await fetch("/api/campaign/calls");
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.records) {
        // Normalize all records
        const normalized: CallRecordsMap = {};
        for (const [key, value] of Object.entries(data.records)) {
          normalized[key] = normalizeRecord(value as CallRecord);
        }
        setRecords(normalized);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch call records:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch records");
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle realtime update
  const handleRealtimeUpdate = useCallback((payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: CallRecord | null;
    old: { id: string; practitioner_id: string } | null;
  }) => {
    console.log("📡 Realtime update:", payload.eventType, payload.new?.practitioner_id || payload.new?.id);

    setRecords((prev) => {
      const updated = { ...prev };

      if (payload.eventType === "DELETE" && payload.old) {
        // Use practitioner_id if available, otherwise use record id for unknown callers
        const key = payload.old.practitioner_id || payload.old.id;
        delete updated[key];
      } else if (payload.new) {
        // Use practitioner_id if available, otherwise use record id for unknown callers
        const key = payload.new.practitioner_id || payload.new.id;
        updated[key] = normalizeRecord(payload.new);
      }

      return updated;
    });
  }, []);

  // Set up realtime subscription
  const setupRealtime = useCallback(() => {
    if (!isBrowserSupabaseConfigured || !supabase) {
      console.log("Supabase not configured, using polling");
      return false;
    }

    try {
      // Clean up existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      const channel = supabase
        .channel("call_records_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "call_records",
          },
          (payload) => {
            handleRealtimeUpdate({
              eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
              new: payload.new as CallRecord | null,
              old: payload.old as { id: string; practitioner_id: string } | null,
            });
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status:", status);
          setIsConnected(status === "SUBSCRIBED");
          
          if (status === "SUBSCRIBED") {
            // Stop polling when realtime is connected
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            // Start polling as fallback
            startPolling();
          }
        });

      subscriptionRef.current = channel;
      return true;
    } catch (err) {
      console.error("Failed to setup realtime:", err);
      return false;
    }
  }, [handleRealtimeUpdate]);

  // Start polling as fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log("Starting polling fallback (every 10s)");
    pollingIntervalRef.current = setInterval(() => {
      fetchRecords();
    }, 10000); // Poll every 10 seconds
  }, [fetchRecords]);

  // Initial load and setup
  useEffect(() => {
    // Initial fetch
    fetchRecords();

    // Try to set up realtime
    const realtimeSetup = setupRealtime();
    
    // If realtime failed, start polling
    if (!realtimeSetup) {
      startPolling();
    }

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchRecords, setupRealtime, startPolling]);

  // Calculate derived values
  const recordsArray = Object.values(records).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const stats = calculateStats(recordsArray);

  return {
    records,
    recordsArray,
    stats,
    loading,
    error,
    refresh: fetchRecords,
    isConnected,
  };
}

// Export default for convenience
export default useSupabaseCallRecords;
