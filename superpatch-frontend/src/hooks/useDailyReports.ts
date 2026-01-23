"use client";

/**
 * Hook for fetching daily campaign analytics from Supabase
 * 
 * Features:
 * - Fetches daily statistics over a date range
 * - Calculates trends and aggregate metrics
 * - Real-time updates via Supabase Realtime
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CampaignAnalytics } from "@/lib/db/types";

interface UseDailyReportsOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

interface AggregateStats {
  totalCalls: number;
  totalCompleted: number;
  totalBooked: number;
  totalFailed: number;
  totalDurationSeconds: number;
  avgCallsPerDay: number;
  avgDurationSeconds: number;
  successRate: number;
  bookingRate: number;
}

interface Trend {
  direction: "up" | "down" | "neutral";
  percentage: number;
}

interface UseDailyReportsResult {
  reports: CampaignAnalytics[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  aggregateStats: AggregateStats;
  trends: {
    calls: Trend;
    bookings: Trend;
    successRate: Trend;
  };
}

export function useDailyReports(
  options: UseDailyReportsOptions = {}
): UseDailyReportsResult {
  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate = new Date(),
    limit = 90,
  } = options;

  const [reports, setReports] = useState<CampaignAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from("campaign_analytics")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0])
        .order("date", { ascending: false })
        .limit(limit);

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setReports(data || []);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, limit]);

  // Calculate aggregate statistics
  const aggregateStats = useMemo((): AggregateStats => {
    if (reports.length === 0) {
      return {
        totalCalls: 0,
        totalCompleted: 0,
        totalBooked: 0,
        totalFailed: 0,
        totalDurationSeconds: 0,
        avgCallsPerDay: 0,
        avgDurationSeconds: 0,
        successRate: 0,
        bookingRate: 0,
      };
    }

    const totals = reports.reduce(
      (acc, report) => ({
        totalCalls: acc.totalCalls + report.total_calls,
        totalCompleted: acc.totalCompleted + report.completed,
        totalBooked: acc.totalBooked + report.booked,
        totalFailed: acc.totalFailed + report.failed,
        totalDurationSeconds: acc.totalDurationSeconds + report.total_duration_seconds,
      }),
      {
        totalCalls: 0,
        totalCompleted: 0,
        totalBooked: 0,
        totalFailed: 0,
        totalDurationSeconds: 0,
      }
    );

    const daysWithData = reports.filter((r) => r.total_calls > 0).length;
    const totalAttempted = totals.totalCompleted + totals.totalFailed;

    return {
      ...totals,
      avgCallsPerDay: daysWithData > 0 ? Math.round(totals.totalCalls / daysWithData) : 0,
      avgDurationSeconds: totals.totalCalls > 0 ? Math.round(totals.totalDurationSeconds / totals.totalCalls) : 0,
      successRate: totalAttempted > 0 ? (totals.totalCompleted / totalAttempted) * 100 : 0,
      bookingRate: totals.totalCompleted > 0 ? (totals.totalBooked / totals.totalCompleted) * 100 : 0,
    };
  }, [reports]);

  // Calculate trends (compare last 7 days to previous 7 days)
  const trends = useMemo(() => {
    const calculateTrend = (current: number, previous: number): Trend => {
      if (previous === 0) {
        return { direction: current > 0 ? "up" : "neutral", percentage: 100 };
      }
      const percentage = ((current - previous) / previous) * 100;
      return {
        direction: percentage > 0 ? "up" : percentage < 0 ? "down" : "neutral",
        percentage: Math.abs(percentage),
      };
    };

    // Sort by date ascending for trend calculation
    const sorted = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get last 7 days and previous 7 days
    const last7 = sorted.slice(-7);
    const prev7 = sorted.slice(-14, -7);

    const sumStats = (data: CampaignAnalytics[]) => ({
      calls: data.reduce((sum, r) => sum + r.total_calls, 0),
      bookings: data.reduce((sum, r) => sum + r.booked, 0),
      completed: data.reduce((sum, r) => sum + r.completed, 0),
      failed: data.reduce((sum, r) => sum + r.failed, 0),
    });

    const current = sumStats(last7);
    const previous = sumStats(prev7);

    const currentSuccessRate = (current.completed + current.failed) > 0
      ? current.completed / (current.completed + current.failed) * 100
      : 0;
    const previousSuccessRate = (previous.completed + previous.failed) > 0
      ? previous.completed / (previous.completed + previous.failed) * 100
      : 0;

    return {
      calls: calculateTrend(current.calls, previous.calls),
      bookings: calculateTrend(current.bookings, previous.bookings),
      successRate: calculateTrend(currentSuccessRate, previousSuccessRate),
    };
  }, [reports]);

  // Handle real-time changes
  const handleChange = useCallback(
    (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: CampaignAnalytics | null;
      old: Partial<CampaignAnalytics> | null;
    }) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log(`📡 Campaign analytics ${eventType}:`, newRecord?.id || oldRecord?.id);

      if (eventType === "INSERT" && newRecord) {
        setReports((prev) => [newRecord, ...prev]);
      }

      if (eventType === "UPDATE" && newRecord) {
        setReports((prev) =>
          prev.map((report) =>
            report.id === newRecord.id ? newRecord : report
          )
        );
      }

      if (eventType === "DELETE" && oldRecord?.id) {
        setReports((prev) => prev.filter((report) => report.id !== oldRecord.id));
      }
    },
    []
  );

  // Set up real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchReports();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("campaign_analytics_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_analytics",
        },
        (payload) => {
          handleChange({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: payload.new as CampaignAnalytics | null,
            old: payload.old as Partial<CampaignAnalytics> | null,
          });
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Analytics] Subscription status:", subStatus);
        setIsConnected(subStatus === "SUBSCRIBED");
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Analytics] Unsubscribing from channel");
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [fetchReports, handleChange]);

  return {
    reports,
    loading,
    error,
    isConnected,
    refresh: fetchReports,
    aggregateStats,
    trends,
  };
}

export default useDailyReports;
