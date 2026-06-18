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
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import type { CallRecord, CampaignAnalytics } from "@/lib/db/types";
import {
  aggregateCallRecordsByDate,
  mergeDailyReports,
  toLocalDateKey,
} from "@/lib/db/campaign-analytics";
import { useRetryTimeouts } from "@/hooks/useRetryTimeout";

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

  const supabase = getBrowserSupabase();

  const [storedReports, setStoredReports] = useState<CampaignAnalytics[]>([]);
  const [liveCallRecords, setLiveCallRecords] = useState<
    Pick<CallRecord, "created_at" | "status" | "duration_seconds" | "appointment_booked">[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const fetchReportsRef = useRef<(() => void) | null>(null);
  const scheduleRetry = useRetryTimeouts();
  const startDateRef = useRef(startDate);
  const endDateRef = useRef(endDate);

  const todayDateKey = useMemo(() => toLocalDateKey(new Date().toISOString()), []);

  const reports = useMemo(() => {
    const liveByDate = aggregateCallRecordsByDate(liveCallRecords);
    return mergeDailyReports(storedReports, liveByDate, todayDateKey);
  }, [storedReports, liveCallRecords, todayDateKey]);

  // Fetch stored reports + live call records.
  //
  // Live call records are sourced from the authenticated `/api/campaign/calls`
  // route — the same source the campaign dashboard uses — NOT a direct browser
  // query. `campaign_analytics` is read via the session-aware browser Supabase
  // client (`getBrowserSupabase`), so the SELECT runs as the logged-in user and
  // passes `is_active_user()` RLS. If the read still fails for any reason we fall
  // back to rendering correct numbers from the live call-record aggregation.
  const fetchReports = useCallback(async () => {
    if (!isBrowserSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    try {
      const [analyticsResult, callsResponse] = await Promise.all([
        supabase
          .from("campaign_analytics")
          .select("*")
          .gte("date", startDate.toISOString().split("T")[0])
          .lte("date", endDate.toISOString().split("T")[0])
          .order("date", { ascending: false })
          .limit(limit),
        fetch("/api/campaign/calls", { credentials: "same-origin" }),
      ]);

      if (!isMountedRef.current) return;

      if (analyticsResult.error) {
        const msg = analyticsResult.error.message ?? "";
        if (!msg.includes("AbortError") && !msg.includes("aborted")) {
          // Reads are now authenticated via the session client; an error here is
          // unexpected. Live aggregation still renders correct numbers as a fallback.
          console.warn("[Reports] campaign_analytics read failed:", msg);
        }
      }

      if (!callsResponse.ok) {
        throw new Error(`Failed to fetch call records: ${callsResponse.status}`);
      }

      const callsData = await callsResponse.json();
      const recordsMap = (callsData?.records ?? {}) as Record<string, CallRecord>;
      const liveRecords = Object.values(recordsMap).filter((record) => {
        const created = new Date(record.created_at).getTime();
        return created >= startMs && created <= endMs;
      });

      if (!isMountedRef.current) return;

      setStoredReports(analyticsResult.data || []);
      setLiveCallRecords(liveRecords);
      setError(null);
    } catch (err) {
      if (err instanceof Error && (err.name === "AbortError" || err.message?.includes("aborted"))) {
        return;
      }
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      if (isMountedRef.current) setLoading(false);
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

      // Helper to check if a record's date is within the filter range
      const isInDateRange = (recordDate: string): boolean => {
        const recordDateObj = new Date(recordDate);
        const start = startDateRef.current;
        const end = endDateRef.current;
        return recordDateObj >= start && recordDateObj <= end;
      };

      if (eventType === "INSERT" && newRecord) {
        if (isInDateRange(newRecord.date)) {
          setStoredReports((prev) => [newRecord, ...prev]);
        }
      }

      if (eventType === "UPDATE" && newRecord) {
        setStoredReports((prev) => {
          const index = prev.findIndex((report) => report.id === newRecord.id);
          const matchesDateRange = isInDateRange(newRecord.date);

          if (index >= 0) {
            if (matchesDateRange) {
              const updated = [...prev];
              updated[index] = newRecord;
              return updated;
            }
            return prev.filter((report) => report.id !== newRecord.id);
          } else if (matchesDateRange) {
            return [newRecord, ...prev];
          }

          return prev;
        });
      }

      if (eventType === "DELETE" && oldRecord?.id) {
        setStoredReports((prev) => prev.filter((report) => report.id !== oldRecord.id));
      }
    },
    []
  );

  // Keep refs in sync
  useEffect(() => {
    fetchReportsRef.current = fetchReports;
  }, [fetchReports]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    startDateRef.current = startDate;
  }, [startDate]);

  useEffect(() => {
    endDateRef.current = endDate;
  }, [endDate]);

  // Set up real-time subscription - runs once on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isBrowserSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

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
          if (isMountedRef.current) {
            handleChange({
              eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
              new: payload.new as CampaignAnalytics | null,
              old: payload.old as Partial<CampaignAnalytics> | null,
            });
          }
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Analytics] Subscription status:", subStatus);
        if (isMountedRef.current) {
          const wasConnected = isConnectedRef.current;
          setIsConnected(subStatus === "SUBSCRIBED");
          isConnectedRef.current = subStatus === "SUBSCRIBED";
          
          // If we just connected, trigger a refetch
          if (subStatus === "SUBSCRIBED" && !wasConnected) {
            console.log("[Realtime Analytics] Connection established, triggering refetch");
            scheduleRetry(() => {
              if (isMountedRef.current && fetchReportsRef.current) {
                fetchReportsRef.current();
              }
            }, 500);
          }
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Analytics] Unsubscribing from channel");
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleChange, scheduleRetry]);

  // Fetch data when filters change, then poll every 15s. The analytics realtime
  // channel only covers nightly campaign_analytics rows; live call records come
  // from `/api/campaign/calls`, so we poll to keep today's counts fresh (mirrors
  // the dashboard's polling fallback).
  useEffect(() => {
    fetchReports();
    const intervalId = setInterval(() => {
      if (isMountedRef.current && fetchReportsRef.current) {
        fetchReportsRef.current();
      }
    }, 15000);
    return () => clearInterval(intervalId);
  }, [fetchReports]);

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
