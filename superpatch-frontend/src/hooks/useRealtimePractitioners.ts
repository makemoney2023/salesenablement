"use client";

/**
 * Hook for real-time practitioner updates via Supabase Realtime
 * 
 * Features:
 * - Subscribes to enrichment_status changes
 * - Provides callbacks for enrichment completion/failure
 * - Tracks practitioners pending enrichment
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useRetryTimeouts } from "@/hooks/useRetryTimeout";

interface Practitioner {
  id: string;
  name: string;
  enrichment_status: "pending" | "in_progress" | "completed" | "failed" | null;
  website?: string | null;
  address?: string | null;
  phone?: string | null;
  practitioner_type?: string | null;
  city?: string | null;
  province?: string | null;
}

interface UseRealtimePractitionersOptions {
  /**
   * Filter by enrichment status (leave empty for all)
   */
  enrichmentStatusFilter?: ("pending" | "in_progress" | "completed" | "failed")[];
  /**
   * Called when a practitioner's enrichment completes successfully
   */
  onEnrichmentComplete?: (practitioner: Practitioner) => void;
  /**
   * Called when a practitioner's enrichment fails
   */
  onEnrichmentFailed?: (practitioner: Practitioner) => void;
  /**
   * Limit results (for pagination)
   */
  limit?: number;
}

interface UseRealtimePractitionersResult {
  practitioners: Practitioner[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
}

export function useRealtimePractitioners(
  options: UseRealtimePractitionersOptions = {}
): UseRealtimePractitionersResult {
  const {
    enrichmentStatusFilter,
    onEnrichmentComplete,
    onEnrichmentFailed,
    limit = 100,
  } = options;

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
  });

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const callbacksRef = useRef({ onEnrichmentComplete, onEnrichmentFailed });
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const fetchPractitionersRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const scheduleRetry = useRetryTimeouts();
  
  // Store filter values in ref for realtime handler
  const filtersRef = useRef({ enrichmentStatusFilter, limit });
  filtersRef.current = { enrichmentStatusFilter, limit };

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = { onEnrichmentComplete, onEnrichmentFailed };
  }, [onEnrichmentComplete, onEnrichmentFailed]);

  // Direct API fallback for practitioners
  const fetchWithDirectAPI = useCallback(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const params = new URLSearchParams();
    params.append('select', 'id,name,enrichment_status,website,address,phone,practitioner_type,city,province');
    params.append('order', 'updated_at.desc');
    params.append('limit', limit.toString());
    
    if (enrichmentStatusFilter && enrichmentStatusFilter.length > 0) {
      params.append('enrichment_status', `in.(${enrichmentStatusFilter.join(',')})`);
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/practitioners?${params.toString()}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }, [enrichmentStatusFilter, limit]);

  // Fallback stats fetcher: count each status separately
  const fetchStatsFallback = useCallback(async () => {
    if (!supabase) return;
    
    const { count: totalCount } = await supabase
      .from("practitioners")
      .select("*", { count: "exact", head: true });

    const { count: pendingCount } = await supabase
      .from("practitioners")
      .select("*", { count: "exact", head: true })
      .eq("enrichment_status", "pending");

    const { count: inProgressCount } = await supabase
      .from("practitioners")
      .select("*", { count: "exact", head: true })
      .eq("enrichment_status", "in_progress");

    const { count: completedCount } = await supabase
      .from("practitioners")
      .select("*", { count: "exact", head: true })
      .eq("enrichment_status", "completed");

    const { count: failedCount } = await supabase
      .from("practitioners")
      .select("*", { count: "exact", head: true })
      .eq("enrichment_status", "failed");

    if (isMountedRef.current) {
      setStats({
        total: totalCount || 0,
        pending: pendingCount || 0,
        inProgress: inProgressCount || 0,
        completed: completedCount || 0,
        failed: failedCount || 0,
      });
    }
  }, []);

  // Fetch practitioners from database with retry logic
  const fetchPractitioners = useCallback(async (isRetry = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    if (!isRetry) {
      retryCountRef.current = 0;
    }

    try {
      let query = supabase
        .from("practitioners")
        .select("id, name, enrichment_status, website, address, phone, practitioner_type, city, province")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (enrichmentStatusFilter && enrichmentStatusFilter.length > 0) {
        query = query.in("enrichment_status", enrichmentStatusFilter);
      }

      const { data, error: fetchError } = await query;
      const practitionerData = data as Practitioner[] | null;

      if (!isMountedRef.current) return;

      if (fetchError) {
        const isAbortError = fetchError.message?.includes('AbortError') || fetchError.message?.includes('aborted');
        
        if (isAbortError) {
          if (practitionerData && practitionerData.length > 0) {
            setPractitioners(practitionerData);
            setError(null);
          } else if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(`[Realtime Practitioners] Retry (attempt ${retryCountRef.current}/${maxRetries})...`);
            scheduleRetry(() => {
              if (isMountedRef.current) {
                fetchPractitioners(true);
              }
            }, 1000);
          } else {
            // Fall back to direct API
            console.log('[Realtime Practitioners] Using direct API fallback...');
            try {
              const fallbackData = await fetchWithDirectAPI();
              if (isMountedRef.current && fallbackData) {
                setPractitioners(fallbackData as Practitioner[]);
                setError(null);
              }
            } catch (fallbackErr) {
              console.error('[Realtime Practitioners] Direct fetch failed:', fallbackErr);
            }
          }
          return;
        }
        
        setError(fetchError.message);
      } else {
        setPractitioners(practitionerData || []);
        setError(null);
      }

      // Try to fetch stats via RPC function (more efficient single query)
      interface EnrichmentStats {
        total: number;
        pending: number;
        in_progress: number;
        completed: number;
        failed: number;
      }
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: statsData, error: statsError } = await (supabase.rpc as any)("get_enrichment_stats");
        
        if (!statsError && statsData && statsData.length > 0) {
          const rpcStats = statsData[0] as EnrichmentStats;
          if (isMountedRef.current) {
            setStats({
              total: rpcStats.total || 0,
              pending: rpcStats.pending || 0,
              inProgress: rpcStats.in_progress || 0,
              completed: rpcStats.completed || 0,
              failed: rpcStats.failed || 0,
            });
          }
        } else {
          // Fallback: count each status separately (if RPC returned error but didn't throw)
          await fetchStatsFallback();
        }
      } catch (rpcErr) {
        // RPC function may not exist — fall back to individual count queries
        console.warn("get_enrichment_stats RPC not available, using defaults:", rpcErr);
        try {
          await fetchStatsFallback();
        } catch {
          // If fallback also fails, use defaults based on practitioners we already have
          if (isMountedRef.current) {
            const pData = practitionerData || [];
            setStats({
              total: pData.length,
              pending: pData.filter(p => p.enrichment_status === "pending").length,
              inProgress: pData.filter(p => p.enrichment_status === "in_progress").length,
              completed: pData.filter(p => p.enrichment_status === "completed").length,
              failed: pData.filter(p => p.enrichment_status === "failed").length,
            });
          }
        }
      }
    } catch (err) {
      const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
      
      if (isAbortError) {
        if (retryCountRef.current < maxRetries && isMountedRef.current) {
          retryCountRef.current++;
          scheduleRetry(() => {
            if (isMountedRef.current) {
              fetchPractitioners(true);
            }
          }, 1000);
        }
        return;
      }
      
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [enrichmentStatusFilter, limit, fetchWithDirectAPI, scheduleRetry, fetchStatsFallback]);

  // Handle real-time changes - uses refs to avoid recreating callback
  const handleChange = useCallback(
    (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: Practitioner | null;
      old: Partial<Practitioner> | null;
    }) => {
      if (!isMountedRef.current) return;
      
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const { enrichmentStatusFilter: currentFilter, limit: currentLimit } = filtersRef.current;

      // Only care about enrichment_status changes
      if (eventType === "UPDATE" && newRecord && oldRecord) {
        const oldStatus = oldRecord.enrichment_status;
        const newStatus = newRecord.enrichment_status;

        if (oldStatus !== newStatus) {
          console.log(`📡 Practitioner ${newRecord.name}: enrichment ${oldStatus} → ${newStatus}`);

          // Notify callbacks
          if (newStatus === "completed" && oldStatus !== "completed") {
            callbacksRef.current.onEnrichmentComplete?.(newRecord);
          } else if (newStatus === "failed" && oldStatus !== "failed") {
            callbacksRef.current.onEnrichmentFailed?.(newRecord);
          }

          // Update stats
          setStats((prev) => {
            const newStats = { ...prev };

            // Decrement old status count
            if (oldStatus === "pending") newStats.pending = Math.max(0, newStats.pending - 1);
            if (oldStatus === "in_progress") newStats.inProgress = Math.max(0, newStats.inProgress - 1);
            if (oldStatus === "completed") newStats.completed = Math.max(0, newStats.completed - 1);
            if (oldStatus === "failed") newStats.failed = Math.max(0, newStats.failed - 1);

            // Increment new status count
            if (newStatus === "pending") newStats.pending++;
            if (newStatus === "in_progress") newStats.inProgress++;
            if (newStatus === "completed") newStats.completed++;
            if (newStatus === "failed") newStats.failed++;

            return newStats;
          });

          // Update in list if matches filter
          setPractitioners((prev) => {
            const matchesFilter =
              !currentFilter ||
              currentFilter.length === 0 ||
              (newStatus && currentFilter.includes(newStatus));

            const index = prev.findIndex((p) => p.id === newRecord.id);

            if (index >= 0) {
              if (matchesFilter) {
                const updated = [...prev];
                updated[index] = newRecord;
                return updated;
              } else {
                return prev.filter((p) => p.id !== newRecord.id);
              }
            } else if (matchesFilter) {
              return [newRecord, ...prev].slice(0, currentLimit);
            }

            return prev;
          });
        }
      }

      if (eventType === "INSERT" && newRecord) {
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          pending: newRecord.enrichment_status === "pending" ? prev.pending + 1 : prev.pending,
        }));
      }
    },
    []
  );

  // Keep refs in sync
  useEffect(() => {
    fetchPractitionersRef.current = fetchPractitioners;
  }, [fetchPractitioners]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Set up real-time subscription - runs once on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Subscribe to real-time changes on enrichment_status column
    const channel = supabase
      .channel("practitioners_enrichment_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "practitioners",
        },
        (payload) => {
          if (isMountedRef.current) {
            handleChange({
              eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
              new: payload.new as Practitioner | null,
              old: payload.old as Partial<Practitioner> | null,
            });
          }
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Practitioners] Subscription status:", subStatus);
        if (isMountedRef.current) {
          const wasConnected = isConnectedRef.current;
          setIsConnected(subStatus === "SUBSCRIBED");
          isConnectedRef.current = subStatus === "SUBSCRIBED";
          
          // If we just connected, trigger a refetch
          if (subStatus === "SUBSCRIBED" && !wasConnected) {
            console.log("[Realtime Practitioners] Connection established, triggering refetch");
            scheduleRetry(() => {
              if (isMountedRef.current && fetchPractitionersRef.current) {
                fetchPractitionersRef.current();
              }
            }, 500);
          }
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Practitioners] Unsubscribing from channel");
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleChange, scheduleRetry]);

  // Fetch data when filters change - separate from subscription
  useEffect(() => {
    fetchPractitioners();
  }, [fetchPractitioners]);

  return {
    practitioners,
    loading,
    error,
    isConnected,
    refresh: fetchPractitioners,
    stats,
  };
}

export default useRealtimePractitioners;
