"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CallRecord, CallStatus, CampaignStats } from "@/lib/db/types";
import * as localStorage from "@/lib/campaign-storage";

interface UseCallRecordsOptions {
  pollInterval?: number; // Polling interval in ms (for localStorage fallback)
  enableRealtime?: boolean; // Enable Supabase realtime subscriptions
}

interface UseCallRecordsReturn {
  records: Record<string, CallRecord>;
  loading: boolean;
  error: string | null;
  stats: CampaignStats;
  refetch: () => Promise<void>;
  updateRecord: (practitionerId: string, updates: Partial<CallRecord>) => Promise<void>;
  createRecord: (practitioner: {
    id: string;
    name: string;
    practitioner_type: string;
    phone: string;
    address: string;
    city: string;
    province: string;
  }) => Promise<CallRecord | null>;
  updateStatus: (practitionerId: string, status: CallStatus) => Promise<void>;
  deleteRecord: (practitionerId: string) => Promise<void>;
  isSupabaseEnabled: boolean;
}

export function useCallRecords(options: UseCallRecordsOptions = {}): UseCallRecordsReturn {
  const { pollInterval = 5000, enableRealtime = true } = options;
  
  const [records, setRecords] = useState<Record<string, CallRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CampaignStats>({
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
  });
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch records from API
  const fetchRecords = useCallback(async () => {
    try {
      const response = await fetch("/api/campaign/calls");
      if (!response.ok) {
        throw new Error("Failed to fetch call records");
      }
      const data = await response.json();
      setRecords(data.records || {});
      setError(null);
    } catch (err) {
      console.error("Error fetching call records:", err);
      
      // Fallback to localStorage
      if (!isSupabaseConfigured) {
        const localRecords = localStorage.getCallRecords();
        setRecords(convertLocalRecords(localRecords));
      }
      
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/campaign/calls?stats=true");
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      // Fallback to localStorage
      if (!isSupabaseConfigured) {
        setStats(localStorage.getCampaignStats());
      }
    }
  }, []);

  // Combined refetch
  const refetch = useCallback(async () => {
    await Promise.all([fetchRecords(), fetchStats()]);
  }, [fetchRecords, fetchStats]);

  // Create a new record
  const createRecord = useCallback(async (practitioner: {
    id: string;
    name: string;
    practitioner_type: string;
    phone: string;
    address: string;
    city: string;
    province: string;
  }): Promise<CallRecord | null> => {
    try {
      const response = await fetch("/api/campaign/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practitioner_id: practitioner.id,
          practitioner_name: practitioner.name,
          practitioner_type: practitioner.practitioner_type,
          phone: practitioner.phone,
          address: practitioner.address,
          city: practitioner.city,
          province: practitioner.province,
          status: "not_called",
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create record");
      }
      
      const data = await response.json();
      
      // Update local state
      setRecords(prev => ({
        ...prev,
        [practitioner.id]: data.record,
      }));
      
      return data.record;
    } catch (err) {
      console.error("Error creating record:", err);
      
      // Fallback to localStorage
      if (!isSupabaseConfigured) {
        const record = localStorage.createCallRecord(practitioner);
        setRecords(prev => ({
          ...prev,
          [practitioner.id]: convertLocalRecord(record),
        }));
        return convertLocalRecord(record);
      }
      
      return null;
    }
  }, []);

  // Update a record
  const updateRecord = useCallback(async (practitionerId: string, updates: Partial<CallRecord>) => {
    try {
      const response = await fetch("/api/campaign/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practitioner_id: practitionerId,
          ...updates,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update record");
      }
      
      const data = await response.json();
      
      // Update local state
      setRecords(prev => ({
        ...prev,
        [practitionerId]: data.record,
      }));
    } catch (err) {
      console.error("Error updating record:", err);
      
      // Fallback to localStorage — avoid reading closed-over `records`; use localStorage directly
      if (!isSupabaseConfigured) {
        const localRecord = localStorage.getCallRecord(practitionerId);
        if (localRecord) {
          const updated = localStorage.updateCallStatus(
            practitionerId,
            (updates.status as CallStatus) || localRecord.status,
            updates as Partial<localStorage.CampaignCallRecord>
          );
          if (updated) {
            setRecords(prev => ({
              ...prev,
              [practitionerId]: convertLocalRecord(updated),
            }));
          }
        }
      }
    }
  }, []);

  // Update status
  const updateStatus = useCallback(async (practitionerId: string, status: CallStatus) => {
    await updateRecord(practitionerId, { status });
  }, [updateRecord]);

  // Delete a record
  const deleteRecord = useCallback(async (practitionerId: string) => {
    try {
      const response = await fetch(`/api/campaign/calls?practitioner_id=${practitionerId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete record");
      }
      
      // Update local state
      setRecords(prev => {
        const newRecords = { ...prev };
        delete newRecords[practitionerId];
        return newRecords;
      });
    } catch (err) {
      console.error("Error deleting record:", err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Set up realtime subscription or polling
  useEffect(() => {
    if (isSupabaseConfigured && enableRealtime && supabase) {
      // Set up Supabase realtime subscription
      const client = supabase;
      const channel = client
        .channel("call_records_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "call_records",
          },
          (payload) => {
            console.log("Realtime update:", payload);
            
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const record = payload.new as CallRecord;
              const key = record.practitioner_id || record.id;  // Use id for unknown callers
              setRecords(prev => ({
                ...prev,
                [key]: record,
              }));
            } else if (payload.eventType === "DELETE") {
              const record = payload.old as CallRecord;
              const key = record.practitioner_id || record.id;  // Use id for unknown callers
              setRecords(prev => {
                const newRecords = { ...prev };
                delete newRecords[key];
                return newRecords;
              });
            }
            
            // Refetch stats on any change
            fetchStats();
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    } else {
      // Fallback to polling for localStorage
      pollIntervalRef.current = setInterval(refetch, pollInterval);
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [enableRealtime, pollInterval, refetch, fetchStats]);

  return {
    records,
    loading,
    error,
    stats,
    refetch,
    createRecord,
    updateRecord,
    updateStatus,
    deleteRecord,
    isSupabaseEnabled: isSupabaseConfigured,
  };
}

// Helper to convert localStorage record to CallRecord type
function convertLocalRecord(record: localStorage.CampaignCallRecord): CallRecord {
  return {
    id: record.practitioner_id,
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

function convertLocalRecords(records: Record<string, localStorage.CampaignCallRecord>): Record<string, CallRecord> {
  return Object.fromEntries(
    Object.entries(records).map(([id, record]) => [id, convertLocalRecord(record)])
  );
}

export default useCallRecords;
