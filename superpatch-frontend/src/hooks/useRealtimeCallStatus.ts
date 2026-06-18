"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import type { CallRecord, CallStatus } from "@/lib/db/types";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface ActiveCall {
  id: string;
  call_id: string | null;
  practitioner_id: string | null;
  practitioner_name: string;
  practitioner_type: string | null;
  phone: string;
  status: CallStatus;
  call_started_at: string | null;
  duration_seconds: number | null;
  city: string | null;
  province: string | null;
}

interface CallChangePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  old: Partial<CallRecord> | null;
  new: Partial<CallRecord> | null;
}

interface UseRealtimeCallStatusOptions {
  /** Filter to only track specific statuses */
  statuses?: CallStatus[];
  /** Callback when a call status changes */
  onCallChange?: (payload: CallChangePayload) => void;
  /** Callback when a new call starts */
  onCallStarted?: (call: ActiveCall) => void;
  /** Callback when a call completes */
  onCallCompleted?: (call: ActiveCall) => void;
}

interface UseRealtimeCallStatusReturn {
  /** List of currently active/in-progress calls */
  activeCalls: ActiveCall[];
  /** Whether realtime is connected */
  isConnected: boolean;
  /** Any connection error */
  error: string | null;
  /** Manually refresh active calls */
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time call status updates via Supabase Realtime
 * 
 * Subscribes to postgres_changes on the call_records table and
 * maintains a list of active/in-progress calls with live updates.
 */
export function useRealtimeCallStatus(
  options: UseRealtimeCallStatusOptions = {}
): UseRealtimeCallStatusReturn {
  const {
    statuses = ["in_progress", "queued"],
    onCallChange,
    onCallStarted,
    onCallCompleted,
  } = options;

  const supabase = getBrowserSupabase();

  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef({ onCallChange, onCallStarted, onCallCompleted });
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const fetchActiveCallsRef = useRef<(() => void) | null>(null);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = { onCallChange, onCallStarted, onCallCompleted };
  }, [onCallChange, onCallStarted, onCallCompleted]);

  // Fetch active calls from database with AbortError handling
  const fetchActiveCalls = useCallback(async () => {
    if (!isBrowserSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("call_records")
        .select("id, call_id, practitioner_id, practitioner_name, practitioner_type, phone, status, call_started_at, duration_seconds, city, province")
        .in("status", statuses)
        .order("call_started_at", { ascending: false });

      if (!isMountedRef.current) return;

      if (fetchError) {
        // Ignore abort errors
        if (fetchError.message?.includes('AbortError') || fetchError.message?.includes('aborted')) return;
        console.error("[Realtime] Error fetching active calls:", fetchError);
        setError(fetchError.message);
        return;
      }

      setActiveCalls((data as ActiveCall[]) || []);
      setError(null);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) return;
      if (!isMountedRef.current) return;
      console.error("[Realtime] Error fetching active calls:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch calls");
    }
  }, [statuses]);

  // Handle realtime changes
  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (payload: RealtimePostgresChangesPayload<any>) => {
      const { eventType, old: oldRecord, new: newRecord } = payload;
      const typedOld = oldRecord as Partial<CallRecord> | null;
      const typedNew = newRecord as Partial<CallRecord> | null;

      console.log(`[Realtime] ${eventType}:`, {
        old_status: typedOld?.status,
        new_status: typedNew?.status,
        call_id: typedNew?.call_id || typedOld?.call_id,
      });

      // Notify callback
      callbacksRef.current.onCallChange?.({
        eventType: eventType as "INSERT" | "UPDATE" | "DELETE",
        old: typedOld,
        new: typedNew,
      });

      if (eventType === "INSERT" && typedNew) {
        const newStatus = typedNew.status;
        
        // Check if this is a new active call
        if (newStatus && statuses.includes(newStatus)) {
          const activeCall: ActiveCall = {
            id: typedNew.id || "",
            call_id: typedNew.call_id || null,
            practitioner_id: typedNew.practitioner_id || null,
            practitioner_name: typedNew.practitioner_name || "Unknown",
            practitioner_type: typedNew.practitioner_type || null,
            phone: typedNew.phone || "",
            status: newStatus,
            call_started_at: typedNew.call_started_at || null,
            duration_seconds: typedNew.duration_seconds || null,
            city: typedNew.city || null,
            province: typedNew.province || null,
          };

          setActiveCalls((prev) => [activeCall, ...prev]);
          
          if (newStatus === "in_progress") {
            callbacksRef.current.onCallStarted?.(activeCall);
          }
        }
      }

      if (eventType === "UPDATE" && typedNew) {
        const newStatus = typedNew.status;
        const oldStatus = typedOld?.status;

        setActiveCalls((prev) => {
          // If status changed to non-active, remove from list
          if (newStatus && !statuses.includes(newStatus)) {
            const removed = prev.find((c) => c.id === typedNew.id);
            if (removed) {
              callbacksRef.current.onCallCompleted?.({
                ...removed,
                status: newStatus,
                duration_seconds: typedNew.duration_seconds || removed.duration_seconds,
              });
            }
            return prev.filter((c) => c.id !== typedNew.id);
          }

          // If status changed to active, add or update
          if (newStatus && statuses.includes(newStatus)) {
            const existingIndex = prev.findIndex((c) => c.id === typedNew.id);
            
            if (existingIndex >= 0) {
              // Update existing
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                status: newStatus,
                call_id: typedNew.call_id ?? updated[existingIndex].call_id,
                duration_seconds: typedNew.duration_seconds ?? updated[existingIndex].duration_seconds,
              };
              return updated;
            } else {
              // Add new
              const activeCall: ActiveCall = {
                id: typedNew.id || "",
                call_id: typedNew.call_id || null,
                practitioner_id: typedNew.practitioner_id || null,
                practitioner_name: typedNew.practitioner_name || "Unknown",
                practitioner_type: typedNew.practitioner_type || null,
                phone: typedNew.phone || "",
                status: newStatus,
                call_started_at: typedNew.call_started_at || null,
                duration_seconds: typedNew.duration_seconds || null,
                city: typedNew.city || null,
                province: typedNew.province || null,
              };

              // Notify if status transitioned to in_progress
              if (newStatus === "in_progress" && oldStatus !== "in_progress") {
                callbacksRef.current.onCallStarted?.(activeCall);
              }

              return [activeCall, ...prev];
            }
          }

          return prev;
        });
      }

      if (eventType === "DELETE" && typedOld) {
        setActiveCalls((prev) => prev.filter((c) => c.id !== typedOld.id));
      }
    },
    [statuses]
  );

  // Keep refs in sync
  useEffect(() => {
    fetchActiveCallsRef.current = fetchActiveCalls;
  }, [fetchActiveCalls]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Set up realtime subscription - runs once on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isBrowserSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return;
    }

    // Subscribe to realtime changes
    const channel = supabase
      .channel("call-records-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_records",
        },
        (payload) => {
          if (isMountedRef.current) {
            handleChange(payload);
          }
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime] Subscription status:", subStatus);
        
        if (isMountedRef.current) {
          const wasConnected = isConnectedRef.current;
          
          if (subStatus === "SUBSCRIBED") {
            setIsConnected(true);
            isConnectedRef.current = true;
            setError(null);
            
            // If we just connected, trigger a refetch
            if (!wasConnected) {
              console.log("[Realtime] Connection established, triggering refetch");
              setTimeout(() => {
                if (isMountedRef.current && fetchActiveCallsRef.current) {
                  fetchActiveCallsRef.current();
                }
              }, 500);
            }
          } else if (subStatus === "CHANNEL_ERROR") {
            setIsConnected(false);
            isConnectedRef.current = false;
            setError("Failed to connect to realtime channel");
          } else if (subStatus === "TIMED_OUT") {
            setIsConnected(false);
            isConnectedRef.current = false;
            setError("Realtime connection timed out");
          }
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime] Unsubscribing from channel");
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleChange]);

  // Fetch data when filters change - separate from subscription
  useEffect(() => {
    fetchActiveCalls();
  }, [fetchActiveCalls]);

  return {
    activeCalls,
    isConnected,
    error,
    refresh: fetchActiveCalls,
  };
}

/**
 * Hook for tracking a single call's status in real-time
 */
export function useCallStatusTracker(callId: string | null) {
  const supabase = getBrowserSupabase();
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!callId || !isBrowserSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // Store supabase in a const for TypeScript to narrow the type
    const sb = supabase;

    // Fetch initial status
    const fetchStatus = async () => {
      const { data } = await sb
        .from("call_records")
        .select("status")
        .eq("call_id", callId)
        .single();

      if (data) {
        setStatus((data as { status: CallStatus }).status);
      }
      setIsLoading(false);
    };

    fetchStatus();

    // Subscribe to updates for this specific call
    const channel = sb
      .channel(`call-status-${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_records",
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const newStatus = (payload.new as Partial<CallRecord>)?.status;
          if (newStatus) {
            setStatus(newStatus);
          }
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [callId]);

  return { status, isLoading };
}
