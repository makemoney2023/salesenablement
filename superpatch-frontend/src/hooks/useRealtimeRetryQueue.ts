"use client";

/**
 * Hook for real-time retry queue updates via Supabase Realtime
 * 
 * Features:
 * - Fetches practitioners with upcoming retries
 * - Subscribes to retry queue changes (next_retry_at updates)
 * - Provides callbacks for retry scheduled/completed
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import { useRetryTimeouts } from "@/hooks/useRetryTimeout";

interface RetryQueueItem {
  id: string;
  name: string;
  phone: string | null;
  practitioner_type: string | null;
  next_retry_at: string | null;
  retry_count: number;
  retry_reason: string | null;
  last_call_status: string | null;
  city: string | null;
  province: string | null;
}

interface UseRealtimeRetryQueueOptions {
  /**
   * How many hours ahead to show upcoming retries (default: 24)
   */
  hoursAhead?: number;
  /**
   * Max items to show
   */
  limit?: number;
  /**
   * Called when a practitioner is added to the retry queue
   */
  onRetryScheduled?: (item: RetryQueueItem) => void;
  /**
   * Called when a retry is processed (removed from queue)
   */
  onRetryProcessed?: (item: RetryQueueItem) => void;
}

interface UseRealtimeRetryQueueResult {
  queue: RetryQueueItem[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  stats: {
    dueNow: number;
    nextHour: number;
    next24Hours: number;
    total: number;
  };
}

export function useRealtimeRetryQueue(
  options: UseRealtimeRetryQueueOptions = {}
): UseRealtimeRetryQueueResult {
  const {
    hoursAhead = 24,
    limit = 50,
    onRetryScheduled,
    onRetryProcessed,
  } = options;

  const supabase = getBrowserSupabase();

  const [queue, setQueue] = useState<RetryQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    dueNow: 0,
    nextHour: 0,
    next24Hours: 0,
    total: 0,
  });

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const callbacksRef = useRef({ onRetryScheduled, onRetryProcessed });
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const fetchQueueRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const scheduleRetry = useRetryTimeouts();
  
  // Store options in ref for realtime handler
  const optionsRef = useRef({ hoursAhead, limit });
  optionsRef.current = { hoursAhead, limit };

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = { onRetryScheduled, onRetryProcessed };
  }, [onRetryScheduled, onRetryProcessed]);

  // Direct API fallback
  const fetchWithDirectAPI = useCallback(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const now = new Date();
    const futureLimit = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const params = new URLSearchParams();
    params.append('select', 'id,name,phone,practitioner_type,next_retry_at,retry_count,retry_reason,last_call_status,city,province');
    params.append('next_retry_at', `not.is.null`);
    params.append('next_retry_at', `lte.${futureLimit.toISOString()}`);
    params.append('do_not_call', 'eq.false');
    params.append('order', 'next_retry_at.asc');
    params.append('limit', limit.toString());

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
  }, [hoursAhead, limit]);

  // Calculate stats helper
  const calculateStats = useCallback((data: RetryQueueItem[]) => {
    const now = new Date();
    const nowTime = now.getTime();
    const oneHourLater = nowTime + 60 * 60 * 1000;
    const twentyFourHoursLater = nowTime + 24 * 60 * 60 * 1000;

    let dueNow = 0;
    let nextHour = 0;
    let next24Hours = 0;

    data.forEach((item: RetryQueueItem) => {
      if (item.next_retry_at) {
        const retryTime = new Date(item.next_retry_at).getTime();
        if (retryTime <= nowTime) {
          dueNow++;
        } else if (retryTime <= oneHourLater) {
          nextHour++;
        } else if (retryTime <= twentyFourHoursLater) {
          next24Hours++;
        }
      }
    });

    return { dueNow, nextHour, next24Hours, total: data.length };
  }, []);

  // Fetch retry queue from database with retry logic
  const fetchQueue = useCallback(async (isRetry = false) => {
    if (!isBrowserSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    if (!isRetry) {
      retryCountRef.current = 0;
    }

    try {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

      const { data, error: fetchError } = await supabase
        .from("practitioners")
        .select("id, name, phone, practitioner_type, next_retry_at, retry_count, retry_reason, last_call_status, city, province")
        .not("next_retry_at", "is", null)
        .lte("next_retry_at", futureLimit.toISOString())
        .eq("do_not_call", false)
        .order("next_retry_at", { ascending: true })
        .limit(limit);

      const queueData = data as RetryQueueItem[] | null;

      // Check if still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (fetchError) {
        const isAbortError = fetchError.message?.includes('AbortError') || fetchError.message?.includes('aborted');
        
        if (isAbortError) {
          if (queueData && queueData.length > 0) {
            setQueue(queueData);
            setStats(calculateStats(queueData));
            setError(null);
          } else if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(`[Realtime RetryQueue] Retry (attempt ${retryCountRef.current}/${maxRetries})...`);
            scheduleRetry(() => {
              if (isMountedRef.current) {
                fetchQueue(true);
              }
            }, 1000);
          } else {
            // Fall back to direct API
            console.log('[Realtime RetryQueue] Using direct API fallback...');
            try {
              const fallbackData = await fetchWithDirectAPI();
              if (isMountedRef.current && fallbackData) {
                setQueue(fallbackData as RetryQueueItem[]);
                setStats(calculateStats(fallbackData as RetryQueueItem[]));
                setError(null);
              }
            } catch (fallbackErr) {
              console.error('[Realtime RetryQueue] Direct fetch failed:', fallbackErr);
            }
          }
          return;
        }
        
        setError(fetchError.message);
      } else {
        setQueue(queueData || []);
        setStats(calculateStats(queueData || []));
        setError(null);
      }
    } catch (err) {
      const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
      
      if (isAbortError) {
        if (retryCountRef.current < maxRetries && isMountedRef.current) {
          retryCountRef.current++;
          scheduleRetry(() => {
            if (isMountedRef.current) {
              fetchQueue(true);
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
  }, [hoursAhead, limit, fetchWithDirectAPI, calculateStats, scheduleRetry]);

  // Handle real-time changes - uses refs to avoid recreating callback
  const handleChange = useCallback(
    (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: RetryQueueItem | null;
      old: Partial<RetryQueueItem> | null;
    }) => {
      if (!isMountedRef.current) return;
      
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const { hoursAhead: currentHoursAhead, limit: currentLimit } = optionsRef.current;

      if (eventType === "UPDATE" && newRecord && oldRecord) {
        const oldRetryAt = oldRecord.next_retry_at;
        const newRetryAt = newRecord.next_retry_at;

        // Retry scheduled (next_retry_at was null, now has value)
        if (!oldRetryAt && newRetryAt) {
          console.log(`📡 Retry scheduled for ${newRecord.name} at ${newRetryAt}`);
          callbacksRef.current.onRetryScheduled?.(newRecord);

          // Add to queue if within window
          const now = new Date();
          const futureLimit = new Date(now.getTime() + currentHoursAhead * 60 * 60 * 1000);
          const retryTime = new Date(newRetryAt);

          if (retryTime <= futureLimit) {
            setQueue((prev) => {
              // Insert in sorted order
              const newQueue = [...prev];
              const insertIndex = newQueue.findIndex(
                (item) => item.next_retry_at && new Date(item.next_retry_at) > retryTime
              );
              if (insertIndex === -1) {
                newQueue.push(newRecord);
              } else {
                newQueue.splice(insertIndex, 0, newRecord);
              }
              return newQueue.slice(0, currentLimit);
            });
          }
        }

        // Retry cleared/processed (next_retry_at had value, now null)
        if (oldRetryAt && !newRetryAt) {
          console.log(`📡 Retry processed for ${newRecord.name}`);
          callbacksRef.current.onRetryProcessed?.(newRecord);

          setQueue((prev) => prev.filter((item) => item.id !== newRecord.id));
        }

        // Retry time updated
        if (oldRetryAt && newRetryAt && oldRetryAt !== newRetryAt) {
          console.log(`📡 Retry rescheduled for ${newRecord.name} from ${oldRetryAt} to ${newRetryAt}`);

          setQueue((prev) => {
            const filtered = prev.filter((item) => item.id !== newRecord.id);

            // Check if new time is within window
            const now = new Date();
            const futureLimit = new Date(now.getTime() + currentHoursAhead * 60 * 60 * 1000);
            const retryTime = new Date(newRetryAt);

            if (retryTime <= futureLimit) {
              const insertIndex = filtered.findIndex(
                (item) => item.next_retry_at && new Date(item.next_retry_at) > retryTime
              );
              if (insertIndex === -1) {
                filtered.push(newRecord);
              } else {
                filtered.splice(insertIndex, 0, newRecord);
              }
            }

            return filtered.slice(0, currentLimit);
          });
        }
      }
    },
    []
  );

  // Keep refs in sync
  useEffect(() => {
    fetchQueueRef.current = fetchQueue;
  }, [fetchQueue]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Set up real-time subscription - runs once on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isBrowserSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Subscribe to real-time changes on practitioners table
    const channel = supabase
      .channel("practitioners_retry_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "practitioners",
        },
        (payload) => {
          if (isMountedRef.current) {
            handleChange({
              eventType: "UPDATE",
              new: payload.new as RetryQueueItem | null,
              old: payload.old as Partial<RetryQueueItem> | null,
            });
          }
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime RetryQueue] Subscription status:", subStatus);
        if (isMountedRef.current) {
          const wasConnected = isConnectedRef.current;
          setIsConnected(subStatus === "SUBSCRIBED");
          isConnectedRef.current = subStatus === "SUBSCRIBED";
          
          // If we just connected, trigger a refetch
          if (subStatus === "SUBSCRIBED" && !wasConnected) {
            console.log("[Realtime RetryQueue] Connection established, triggering refetch");
            scheduleRetry(() => {
              if (isMountedRef.current && fetchQueueRef.current) {
                fetchQueueRef.current();
              }
            }, 500);
          }
        }
      });

    channelRef.current = channel;

    // Also set up an interval to refresh stats (for time-based calculations)
    const refreshInterval = setInterval(() => {
      if (isMountedRef.current && fetchQueueRef.current) {
        fetchQueueRef.current();
      }
    }, 60000); // Refresh every minute to update time-based stats

    // Cleanup
    return () => {
      console.log("[Realtime RetryQueue] Unsubscribing from channel");
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearInterval(refreshInterval);
    };
  }, [handleChange, scheduleRetry]);

  // Fetch data when options change - separate from subscription
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return {
    queue,
    loading,
    error,
    isConnected,
    refresh: fetchQueue,
    stats,
  };
}

export default useRealtimeRetryQueue;
