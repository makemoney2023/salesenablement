"use client";

/**
 * Hook for fetching sidebar badge counts from Supabase
 * 
 * Features:
 * - Fetches counts for pending samples, upcoming appointments, and new pathway suggestions
 * - Tracks last-visited timestamps in localStorage
 * - Real-time updates via Supabase Realtime
 * - Clears badge when user visits the respective page
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useRetryTimeouts } from "@/hooks/useRetryTimeout";

interface BadgeCounts {
  samples: number;
  appointments: number;
  pathwayInsights: number;
  followUpQueue: number;
}

interface UseSidebarBadgesResult {
  counts: BadgeCounts;
  loading: boolean;
  refresh: () => Promise<void>;
}

// LocalStorage keys for tracking last visit times
const LAST_VISIT_KEYS = {
  samples: "sidebar_lastVisit_samples",
  appointments: "sidebar_lastVisit_appointments",
  pathwayInsights: "sidebar_lastVisit_pathwayInsights",
  followUpQueue: "sidebar_lastVisit_followUpQueue",
};

// Route paths for each badge
const BADGE_ROUTES = {
  samples: "/campaign/samples",
  appointments: "/campaign/appointments",
  pathwayInsights: "/campaign/pathway-suggestions",
  followUpQueue: "/campaign/follow-up-queue",
};

export function useSidebarBadges(): UseSidebarBadgesResult {
  const pathname = usePathname();
  const [counts, setCounts] = useState<BadgeCounts>({
    samples: 0,
    appointments: 0,
    pathwayInsights: 0,
    followUpQueue: 0,
  });
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const fetchCountsRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const scheduleRetry = useRetryTimeouts();

  // Update last visit time when user navigates to a badge page
  useEffect(() => {
    const now = new Date().toISOString();
    
    try {
      if (pathname === BADGE_ROUTES.samples) {
        localStorage.setItem(LAST_VISIT_KEYS.samples, now);
        setCounts((prev) => ({ ...prev, samples: 0 }));
      } else if (pathname === BADGE_ROUTES.appointments) {
        localStorage.setItem(LAST_VISIT_KEYS.appointments, now);
        setCounts((prev) => ({ ...prev, appointments: 0 }));
      } else if (pathname === BADGE_ROUTES.pathwayInsights) {
        localStorage.setItem(LAST_VISIT_KEYS.pathwayInsights, now);
        setCounts((prev) => ({ ...prev, pathwayInsights: 0 }));
      } else if (pathname === BADGE_ROUTES.followUpQueue) {
        localStorage.setItem(LAST_VISIT_KEYS.followUpQueue, now);
        setCounts((prev) => ({ ...prev, followUpQueue: 0 }));
      }
    } catch {
      // localStorage may be unavailable in SSR or private browsing
    }
  }, [pathname]);

  // Direct API fallback for counts
  const fetchCountsWithDirectAPI = useCallback(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return null;

    try {
      const [samplesResp, appointmentsResp, pathwayResp, followUpResp] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/sample_requests?select=id&status=eq.pending`, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'count=exact',
          },
        }),
        fetch(`${supabaseUrl}/rest/v1/appointments?select=id&status=in.(scheduled,confirmed)&scheduled_at=gte.${new Date().toISOString()}`, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'count=exact',
          },
        }),
        fetch(`${supabaseUrl}/rest/v1/pathway_suggestions?select=id&status=eq.new`, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'count=exact',
          },
        }),
        fetch(`${supabaseUrl}/rest/v1/follow_up_queue?select=id&status=eq.draft`, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'count=exact',
          },
        }),
      ]);

      // Extract counts from content-range header
      const parseCount = (resp: Response): number => {
        const range = resp.headers.get('content-range');
        if (range) {
          const match = range.match(/\/(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        }
        return 0;
      };

      return {
        samples: parseCount(samplesResp),
        appointments: parseCount(appointmentsResp),
        pathwayInsights: parseCount(pathwayResp),
        followUpQueue: parseCount(followUpResp),
      };
    } catch {
      return null;
    }
  }, []);

  // Fetch badge counts with retry logic
  const fetchCounts = useCallback(async (isRetry = false) => {
    if (!isSupabaseConfigured || !supabase) {
      if (isMountedRef.current) setLoading(false);
      return;
    }

    if (!isRetry) {
      retryCountRef.current = 0;
    }

    try {
      // Fetch counts in parallel
      const [samplesResult, appointmentsResult, pathwayResult, followUpResult] = await Promise.all([
        // Pending sample requests
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("sample_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        // Upcoming appointments (scheduled or confirmed, in the future)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .in("status", ["scheduled", "confirmed"])
          .gte("scheduled_at", new Date().toISOString()),

        // New pathway suggestions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("pathway_suggestions")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),

        // Draft follow-up items waiting for review
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("follow_up_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft"),
      ]);

      // Check if still mounted before updating state
      if (!isMountedRef.current) return;

      // Check for AbortErrors in any of the results
      const hasAbortError = [samplesResult, appointmentsResult, pathwayResult, followUpResult].some(
        (result) => result.error?.message?.includes('AbortError') || result.error?.message?.includes('aborted')
      );
      
      if (hasAbortError) {
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log(`[Sidebar Badges] Retry (attempt ${retryCountRef.current}/${maxRetries})...`);
          scheduleRetry(() => {
            if (isMountedRef.current) {
              fetchCounts(true);
            }
          }, 1000);
        } else {
          // Fall back to direct API
          console.log('[Sidebar Badges] Using direct API fallback...');
          const fallbackCounts = await fetchCountsWithDirectAPI();
          if (isMountedRef.current && fallbackCounts) {
            setCounts(fallbackCounts);
          }
        }
        return;
      }

      // Log any non-abort errors but still update with available counts
      if (samplesResult.error) console.error("Error fetching samples count:", samplesResult.error);
      if (appointmentsResult.error) console.error("Error fetching appointments count:", appointmentsResult.error);
      if (pathwayResult.error) console.error("Error fetching pathway count:", pathwayResult.error);
      if (followUpResult.error) console.error("Error fetching follow-up queue count:", followUpResult.error);

      setCounts({
        samples: samplesResult.count || 0,
        appointments: appointmentsResult.count || 0,
        pathwayInsights: pathwayResult.count || 0,
        followUpQueue: followUpResult.count || 0,
      });
    } catch (err) {
      const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
      
      if (isAbortError) {
        if (retryCountRef.current < maxRetries && isMountedRef.current) {
          retryCountRef.current++;
          scheduleRetry(() => {
            if (isMountedRef.current) {
              fetchCounts(true);
            }
          }, 1000);
        }
        return;
      }
      
      if (!isMountedRef.current) return;
      console.error("Error fetching sidebar badge counts:", err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [fetchCountsWithDirectAPI, scheduleRetry]);

  // Keep refs in sync
  useEffect(() => {
    fetchCountsRef.current = fetchCounts;
  }, [fetchCounts]);

  // Set up real-time subscriptions - runs once on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Subscribe to changes on all three tables
    const channel = supabase
      .channel("sidebar_badges")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sample_requests" },
        () => {
          if (isMountedRef.current && fetchCountsRef.current) {
            console.log("📡 Sample requests changed, refreshing badge");
            fetchCountsRef.current();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          if (isMountedRef.current && fetchCountsRef.current) {
            console.log("📡 Appointments changed, refreshing badge");
            fetchCountsRef.current();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pathway_suggestions" },
        () => {
          if (isMountedRef.current && fetchCountsRef.current) {
            console.log("📡 Pathway suggestions changed, refreshing badge");
            fetchCountsRef.current();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follow_up_queue" },
        () => {
          if (isMountedRef.current && fetchCountsRef.current) {
            console.log("📡 Follow-up queue changed, refreshing badge");
            fetchCountsRef.current();
          }
        }
      )
      .subscribe((subStatus) => {
        console.log("[Sidebar Badges] Subscription status:", subStatus);
        if (isMountedRef.current) {
          const wasConnected = isConnectedRef.current;
          isConnectedRef.current = subStatus === "SUBSCRIBED";
          
          // If we just connected, trigger a refetch
          if (subStatus === "SUBSCRIBED" && !wasConnected) {
            console.log("[Sidebar Badges] Connection established, triggering refetch");
            scheduleRetry(() => {
              if (isMountedRef.current && fetchCountsRef.current) {
                fetchCountsRef.current();
              }
            }, 500);
          }
        }
      });

    channelRef.current = channel;

    return () => {
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [scheduleRetry]);

  // Fetch data on mount and when fetchCounts changes
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    loading,
    refresh: fetchCounts,
  };
}

export default useSidebarBadges;
