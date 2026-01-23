"use client";

/**
 * Hook for fetching and managing sample requests from Supabase
 * 
 * Features:
 * - Fetches sample requests with filtering and pagination
 * - Status update actions (approve, ship, complete)
 * - Real-time updates via Supabase Realtime
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { SampleRequest, SampleStatus, SampleRequestUpdate } from "@/lib/db/types";

interface UseSampleRequestsOptions {
  statusFilter?: SampleStatus | "all";
  search?: string;
  page?: number;
  limit?: number;
}

interface StatusCounts {
  pending: number;
  approved: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

interface UseSampleRequestsResult {
  samples: SampleRequest[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  updateSample: (id: string, updates: SampleRequestUpdate) => Promise<boolean>;
  updateMultiple: (ids: string[], updates: SampleRequestUpdate) => Promise<boolean>;
  deleteSample: (id: string) => Promise<boolean>;
  statusCounts: StatusCounts;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  setPage: (page: number) => void;
}

export function useSampleRequests(
  options: UseSampleRequestsOptions = {}
): UseSampleRequestsResult {
  const {
    statusFilter = "all",
    search = "",
    page: initialPage = 1,
    limit = 25,
  } = options;

  const [samples, setSamples] = useState<SampleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    pending: 0,
    approved: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  });

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  // Fetch status counts
  const fetchStatusCounts = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("sample_requests")
        .select("status");

      if (error) {
        console.error("Error fetching status counts:", error);
        return;
      }

      const counts: StatusCounts = {
        pending: 0,
        approved: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      };

      data?.forEach((item: { status: SampleStatus }) => {
        if (item.status in counts) {
          counts[item.status]++;
        }
      });

      setStatusCounts(counts);
    } catch (err) {
      console.error("Error fetching status counts:", err);
    }
  }, []);

  // Fetch samples via API (which handles pagination)
  const fetchSamples = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/samples?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch samples");
      }

      setSamples(data.samples || []);
      setTotal(data.pagination?.total || 0);
      setError(null);

      // Also fetch counts
      await fetchStatusCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page, limit, fetchStatusCounts]);

  // Update a single sample
  const updateSample = useCallback(async (id: string, updates: SampleRequestUpdate): Promise<boolean> => {
    try {
      const response = await fetch("/api/samples", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, updates }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update");
      }

      // Update local state
      if (data.samples?.[0]) {
        setSamples((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...data.samples[0] } : s))
        );
      }

      // Refresh counts
      await fetchStatusCounts();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      return false;
    }
  }, [fetchStatusCounts]);

  // Update multiple samples
  const updateMultiple = useCallback(async (ids: string[], updates: SampleRequestUpdate): Promise<boolean> => {
    try {
      const response = await fetch("/api/samples", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, updates }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update");
      }

      // Refresh the list
      await fetchSamples();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      return false;
    }
  }, [fetchSamples]);

  // Delete a sample (using cancelled status)
  const deleteSample = useCallback(async (id: string): Promise<boolean> => {
    return updateSample(id, { status: "cancelled" });
  }, [updateSample]);

  // Handle real-time changes
  const handleChange = useCallback(
    (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: SampleRequest | null;
      old: Partial<SampleRequest> | null;
    }) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log(`📡 Sample requests ${eventType}:`, newRecord?.id || oldRecord?.id);

      // For simplicity, just refresh the list
      fetchSamples();
    },
    [fetchSamples]
  );

  // Set up real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchSamples();

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
          handleChange({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: payload.new as SampleRequest | null,
            old: payload.old as Partial<SampleRequest> | null,
          });
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Samples] Subscription status:", subStatus);
        setIsConnected(subStatus === "SUBSCRIBED");
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Samples] Unsubscribing from channel");
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [fetchSamples, handleChange]);

  // Re-fetch when filters change
  useEffect(() => {
    fetchSamples();
  }, [statusFilter, search, page, fetchSamples]);

  return {
    samples,
    loading,
    error,
    isConnected,
    refresh: fetchSamples,
    updateSample,
    updateMultiple,
    deleteSample,
    statusCounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
    setPage,
  };
}

export default useSampleRequests;
