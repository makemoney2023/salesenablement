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

interface BadgeCounts {
  samples: number;
  appointments: number;
  pathwayInsights: number;
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
};

// Route paths for each badge
const BADGE_ROUTES = {
  samples: "/campaign/samples",
  appointments: "/campaign/appointments",
  pathwayInsights: "/campaign/pathway-suggestions",
};

export function useSidebarBadges(): UseSidebarBadgesResult {
  const pathname = usePathname();
  const [counts, setCounts] = useState<BadgeCounts>({
    samples: 0,
    appointments: 0,
    pathwayInsights: 0,
  });
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  // Update last visit time when user navigates to a badge page
  useEffect(() => {
    const now = new Date().toISOString();
    
    if (pathname === BADGE_ROUTES.samples) {
      localStorage.setItem(LAST_VISIT_KEYS.samples, now);
      setCounts((prev) => ({ ...prev, samples: 0 }));
    } else if (pathname === BADGE_ROUTES.appointments) {
      localStorage.setItem(LAST_VISIT_KEYS.appointments, now);
      setCounts((prev) => ({ ...prev, appointments: 0 }));
    } else if (pathname === BADGE_ROUTES.pathwayInsights) {
      localStorage.setItem(LAST_VISIT_KEYS.pathwayInsights, now);
      setCounts((prev) => ({ ...prev, pathwayInsights: 0 }));
    }
  }, [pathname]);

  // Fetch badge counts
  const fetchCounts = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    try {
      // Get last visit times from localStorage
      const lastSamplesVisit = localStorage.getItem(LAST_VISIT_KEYS.samples);
      const lastAppointmentsVisit = localStorage.getItem(LAST_VISIT_KEYS.appointments);
      const lastPathwayVisit = localStorage.getItem(LAST_VISIT_KEYS.pathwayInsights);

      // Fetch counts in parallel
      const [samplesResult, appointmentsResult, pathwayResult] = await Promise.all([
        // Pending sample requests
        (supabase as any)
          .from("sample_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        // Upcoming appointments (scheduled or confirmed, in the future)
        (supabase as any)
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .in("status", ["scheduled", "confirmed"])
          .gte("scheduled_at", new Date().toISOString()),

        // New pathway suggestions
        (supabase as any)
          .from("pathway_suggestions")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
      ]);

      setCounts({
        samples: samplesResult.count || 0,
        appointments: appointmentsResult.count || 0,
        pathwayInsights: pathwayResult.count || 0,
      });
    } catch (err) {
      console.error("Error fetching sidebar badge counts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchCounts();

    // Subscribe to changes on all three tables
    const channel = supabase
      .channel("sidebar_badges")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sample_requests" },
        () => {
          console.log("📡 Sample requests changed, refreshing badge");
          fetchCounts();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          console.log("📡 Appointments changed, refreshing badge");
          fetchCounts();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pathway_suggestions" },
        () => {
          console.log("📡 Pathway suggestions changed, refreshing badge");
          fetchCounts();
        }
      )
      .subscribe((status) => {
        console.log("[Sidebar Badges] Subscription status:", status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchCounts]);

  return {
    counts,
    loading,
    refresh: fetchCounts,
  };
}

export default useSidebarBadges;
