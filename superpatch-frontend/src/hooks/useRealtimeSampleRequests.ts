"use client";

/**
 * Hook for real-time sample request updates via Supabase Realtime
 * 
 * Features:
 * - Fetches sample requests from Supabase
 * - Subscribes to real-time updates
 * - Provides filtering by status
 * - Callbacks for new requests and status changes
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { SampleRequest, SampleStatus } from "@/lib/db/types";

interface UseRealtimeSampleRequestsOptions {
  statusFilter?: SampleStatus | "all";
  onNewRequest?: (request: SampleRequest) => void;
  onStatusChange?: (request: SampleRequest, oldStatus: SampleStatus) => void;
}

interface UseRealtimeSampleRequestsResult {
  requests: SampleRequest[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  pagination: {
    total: number;
  };
}

export function useRealtimeSampleRequests(
  options: UseRealtimeSampleRequestsOptions = {}
): UseRealtimeSampleRequestsResult {
  const { statusFilter = "all", onNewRequest, onStatusChange } = options;

  const [requests, setRequests] = useState<SampleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [total, setTotal] = useState(0);

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const callbacksRef = useRef({ onNewRequest, onStatusChange });
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const fetchRequestsRef = useRef<(() => void) | null>(null);
  const statusFilterRef = useRef(statusFilter);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = { onNewRequest, onStatusChange };
  }, [onNewRequest, onStatusChange]);

  // Fetch requests from database with AbortError handling
  const fetchRequests = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from("sample_requests")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: fetchError, count } = await query;

      if (!isMountedRef.current) return;

      if (fetchError) {
        // Ignore abort errors
        if (fetchError.message?.includes('AbortError') || fetchError.message?.includes('aborted')) return;
        setError(fetchError.message);
      } else {
        setRequests((data as SampleRequest[]) || []);
        setTotal(count || 0);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) return;
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [statusFilter]);

  // Handle real-time changes
  const handleChange = useCallback(
    (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: SampleRequest | null;
      old: Partial<SampleRequest> | null;
    }) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log(`📡 Sample request ${eventType}:`, newRecord?.id || oldRecord?.id);

      if (eventType === "INSERT" && newRecord) {
        // Check if matches filter
        if (statusFilterRef.current === "all" || newRecord.status === statusFilterRef.current) {
          setRequests((prev) => [newRecord, ...prev]);
          setTotal((prev) => prev + 1);
          callbacksRef.current.onNewRequest?.(newRecord);
        }
      }

      if (eventType === "UPDATE" && newRecord) {
        setRequests((prev) => {
          const index = prev.findIndex((r) => r.id === newRecord.id);

          // Status changed - notify callback
          if (oldRecord?.status && oldRecord.status !== newRecord.status) {
            callbacksRef.current.onStatusChange?.(newRecord, oldRecord.status as SampleStatus);
          }

          // Handle filter
          const matchesFilter = statusFilterRef.current === "all" || newRecord.status === statusFilterRef.current;

          if (index >= 0) {
            if (matchesFilter) {
              const updated = [...prev];
              updated[index] = newRecord;
              return updated;
            } else {
              // No longer matches filter, remove it
              setTotal((t) => Math.max(0, t - 1));
              return prev.filter((r) => r.id !== newRecord.id);
            }
          } else if (matchesFilter) {
            // Newly matches filter, add it
            setTotal((t) => t + 1);
            return [newRecord, ...prev];
          }

          return prev;
        });
      }

      if (eventType === "DELETE" && oldRecord?.id) {
        setRequests((prev) => {
          const wasIncluded = prev.some((r) => r.id === oldRecord.id);
          if (wasIncluded) {
            setTotal((t) => Math.max(0, t - 1));
          }
          return prev.filter((r) => r.id !== oldRecord.id);
        });
      }
    },
    []
  );

  // Keep refs in sync
  useEffect(() => {
    fetchRequestsRef.current = fetchRequests;
  }, [fetchRequests]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

  // Set up real-time subscription - runs once on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Subscribe to real-time changes
    const channel = supabase
      .channel("sample_requests_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sample_requests",
        },
        (payload) => {
          if (isMountedRef.current) {
            handleChange({
              eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
              new: payload.new as SampleRequest | null,
              old: payload.old as Partial<SampleRequest> | null,
            });
          }
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Samples] Subscription status:", subStatus);
        if (isMountedRef.current) {
          const wasConnected = isConnectedRef.current;
          setIsConnected(subStatus === "SUBSCRIBED");
          isConnectedRef.current = subStatus === "SUBSCRIBED";
          
          // If we just connected, trigger a refetch
          if (subStatus === "SUBSCRIBED" && !wasConnected) {
            console.log("[Realtime Samples] Connection established, triggering refetch");
            setTimeout(() => {
              if (isMountedRef.current && fetchRequestsRef.current) {
                fetchRequestsRef.current();
              }
            }, 500);
          }
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Samples] Unsubscribing from channel");
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleChange]);

  // Fetch data when filters change - separate from subscription
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    loading,
    error,
    isConnected,
    refresh: fetchRequests,
    pagination: {
      total,
    },
  };
}

export default useRealtimeSampleRequests;
