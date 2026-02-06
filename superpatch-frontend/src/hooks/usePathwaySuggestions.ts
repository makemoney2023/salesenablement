"use client";

/**
 * Hook for fetching and managing pathway suggestions from Supabase
 * 
 * Features:
 * - Fetches pathway suggestions with filtering
 * - Updates suggestion status (approve, dismiss, implement)
 * - Real-time updates via Supabase Realtime
 * - Aggregates counts by status and practitioner type
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { 
  PathwaySuggestion, 
  PathwaySuggestionStatus,
  PathwaySuggestionType,
  PathwaySuggestionSeverity 
} from "@/lib/db/types";

interface PathwaySuggestionFilters {
  status?: PathwaySuggestionStatus | "all";
  practitionerType?: string | "all";
  suggestionType?: PathwaySuggestionType | "all";
  severity?: PathwaySuggestionSeverity | "all";
  search?: string;
}

interface StatusCounts {
  new: number;
  approved: number;
  implemented: number;
  dismissed: number;
  reviewed: number;
}

interface PendingByPractitioner {
  [practitionerType: string]: {
    count: number;
    suggestions: PathwaySuggestion[];
  };
}

interface UsePathwaySuggestionsResult {
  suggestions: PathwaySuggestion[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  updateStatus: (id: string, status: PathwaySuggestionStatus) => Promise<boolean>;
  markAllImplemented: (practitionerType: string) => Promise<boolean>;
  statusCounts: StatusCounts;
  pendingByPractitioner: PendingByPractitioner;
  pagination: {
    total: number;
  };
}

export function usePathwaySuggestions(
  filters: PathwaySuggestionFilters = {}
): UsePathwaySuggestionsResult {
  const {
    status = "all",
    practitionerType = "all",
    suggestionType = "all",
    severity = "all",
    search = "",
  } = filters;

  const [suggestions, setSuggestions] = useState<PathwaySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    new: 0,
    approved: 0,
    implemented: 0,
    dismissed: 0,
    reviewed: 0,
  });
  const [pendingByPractitioner, setPendingByPractitioner] = useState<PendingByPractitioner>({});

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const fetchSuggestionsRef = useRef<(() => void) | null>(null);
  
  // Store current filter values in refs so realtime handler can access them
  const filtersRef = useRef({ status, practitionerType, suggestionType, severity });
  filtersRef.current = { status, practitionerType, suggestionType, severity };

  // Fetch status counts
  const fetchStatusCounts = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("pathway_suggestions")
        .select("status");

      // Check if still mounted before updating state
      if (!isMountedRef.current) return;

      console.log('[PathwaySuggestions] Status counts raw data:', { dataLength: data?.length, error });

      if (error) {
        // Ignore abort errors - they happen during normal cleanup
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) return;
        console.error("Error fetching status counts:", error);
        return;
      }

      const counts: StatusCounts = {
        new: 0,
        approved: 0,
        implemented: 0,
        dismissed: 0,
        reviewed: 0,
      };

      data?.forEach((item: { status: PathwaySuggestionStatus }) => {
        if (item.status in counts) {
          counts[item.status]++;
        }
      });

      setStatusCounts(counts);
    } catch (err) {
      // Ignore abort errors - they happen during normal cleanup
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) return;
      if (!isMountedRef.current) return;
      console.error("Error fetching status counts:", err);
    }
  }, []);

  // Fetch pending suggestions grouped by practitioner type
  const fetchPendingByPractitioner = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("pathway_suggestions")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: true });

      // Check if still mounted before updating state
      if (!isMountedRef.current) return;

      if (error) {
        // Ignore abort errors - they happen during normal cleanup
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) return;
        console.error("Error fetching pending suggestions:", error);
        return;
      }

      const grouped: PendingByPractitioner = {};
      (data as PathwaySuggestion[])?.forEach((suggestion) => {
        const type = suggestion.practitioner_type;
        if (!grouped[type]) {
          grouped[type] = { count: 0, suggestions: [] };
        }
        grouped[type].count++;
        grouped[type].suggestions.push(suggestion);
      });

      setPendingByPractitioner(grouped);
    } catch (err) {
      // Ignore abort errors - they happen during normal cleanup
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) return;
      if (!isMountedRef.current) return;
      console.error("Error fetching pending by practitioner:", err);
    }
  }, []);

  // Retry count ref
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Direct fetch fallback when Supabase client fails
  const fetchWithDirectAPI = useCallback(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    // Build query params
    const params = new URLSearchParams();
    params.append('select', '*');
    params.append('order', 'frequency_count.desc,severity.desc,created_at.desc');
    
    if (status !== 'all') {
      params.append('status', `eq.${status}`);
    }
    if (practitionerType !== 'all') {
      params.append('practitioner_type', `eq.${practitionerType}`);
    }
    if (suggestionType !== 'all') {
      params.append('suggestion_type', `eq.${suggestionType}`);
    }
    if (severity !== 'all') {
      params.append('severity', `eq.${severity}`);
    }

    const url = `${supabaseUrl}/rest/v1/pathway_suggestions?${params.toString()}`;
    console.log('[PathwaySuggestions] Using direct fetch fallback:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const count = parseInt(response.headers.get('content-range')?.split('/')[1] || '0', 10);
    
    return { data, count };
  }, [status, practitionerType, suggestionType, severity]);

  // Fetch suggestions from database with retry logic
  const fetchSuggestions = useCallback(async (isRetry = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Reset retry count on new fetch (not a retry)
    if (!isRetry) {
      retryCountRef.current = 0;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("pathway_suggestions")
        .select("*", { count: "exact" })
        .order("frequency_count", { ascending: false })
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false });

      if (status !== "all") {
        query = query.eq("status", status);
      }

      if (practitionerType !== "all") {
        query = query.eq("practitioner_type", practitionerType);
      }

      if (suggestionType !== "all") {
        query = query.eq("suggestion_type", suggestionType);
      }

      if (severity !== "all") {
        query = query.eq("severity", severity);
      }

      if (search) {
        query = query.or(`suggested_content.ilike.%${search}%,reasoning.ilike.%${search}%,node_name.ilike.%${search}%`);
      }

      const { data, error: fetchError, count } = await query;

      console.log('[PathwaySuggestions] Fetch result:', { 
        dataLength: data?.length, 
        count, 
        error: fetchError,
        filters: { status, practitionerType, suggestionType, severity, search },
        isMounted: isMountedRef.current,
        retryCount: retryCountRef.current
      });

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        console.log('[PathwaySuggestions] Component unmounted, skipping state update');
        return;
      }

      if (fetchError) {
        // Check if it's an abort error
        const isAbortError = fetchError.message?.includes('AbortError') || fetchError.message?.includes('aborted');
        
        if (isAbortError) {
          console.log('[PathwaySuggestions] AbortError in response');
          
          // If we got data despite the abort, use it
          if (data && data.length > 0) {
            console.log('[PathwaySuggestions] Setting suggestions despite abort:', data.length, 'items');
            setSuggestions((data as PathwaySuggestion[]) || []);
            setTotal(count || 0);
            setError(null);
          } else if (retryCountRef.current < maxRetries) {
            // No data and we can retry - wait and try again
            retryCountRef.current++;
            console.log(`[PathwaySuggestions] Retrying fetch (attempt ${retryCountRef.current}/${maxRetries}) in 1 second...`);
            setTimeout(() => {
              if (isMountedRef.current) {
                fetchSuggestions(true);
              }
            }, 1000);
          } else {
            // Max retries reached - try direct API as fallback
            console.log('[PathwaySuggestions] Max retries reached, trying direct fetch fallback...');
            try {
              const { data: fallbackData, count: fallbackCount } = await fetchWithDirectAPI();
              if (isMountedRef.current && fallbackData) {
                console.log('[PathwaySuggestions] Direct fetch succeeded:', fallbackData.length, 'items');
                setSuggestions(fallbackData as PathwaySuggestion[]);
                setTotal(fallbackCount || fallbackData.length);
                setError(null);
                
                // Also fetch counts
                await Promise.all([fetchStatusCounts(), fetchPendingByPractitioner()]);
              }
            } catch (fallbackErr) {
              console.error('[PathwaySuggestions] Direct fetch also failed:', fallbackErr);
              if (isMountedRef.current) {
                setError('Failed to fetch suggestions. Please try refreshing the page.');
              }
            }
          }
          return;
        }
        
        console.log('[PathwaySuggestions] Setting error:', fetchError.message);
        setError(fetchError.message);
      } else {
        console.log('[PathwaySuggestions] Setting suggestions:', data?.length, 'items');
        setSuggestions((data as PathwaySuggestion[]) || []);
        setTotal(count || 0);
        setError(null);
      }

      // Also fetch counts and pending
      console.log('[PathwaySuggestions] Fetching counts and pending...');
      await Promise.all([fetchStatusCounts(), fetchPendingByPractitioner()]);
      console.log('[PathwaySuggestions] Counts and pending fetched');
    } catch (err) {
      console.log('[PathwaySuggestions] Caught error:', err);
      // Check if abort error
      const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
      
      if (isAbortError) {
        console.log('[PathwaySuggestions] AbortError caught');
        if (retryCountRef.current < maxRetries && isMountedRef.current) {
          retryCountRef.current++;
          console.log(`[PathwaySuggestions] Retrying fetch (attempt ${retryCountRef.current}/${maxRetries}) in 1 second...`);
          setTimeout(() => {
            if (isMountedRef.current) {
              fetchSuggestions(true);
            }
          }, 1000);
        }
        return;
      }
      
      if (!isMountedRef.current) {
        console.log('[PathwaySuggestions] Component unmounted in catch, skipping error state');
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      console.log('[PathwaySuggestions] Finally block, isMounted:', isMountedRef.current);
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [status, practitionerType, suggestionType, severity, search, fetchStatusCounts, fetchPendingByPractitioner, fetchWithDirectAPI]);

  // Keep refs in sync with state/callbacks
  useEffect(() => {
    fetchSuggestionsRef.current = fetchSuggestions;
  }, [fetchSuggestions]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Update suggestion status
  const updateStatus = useCallback(async (id: string, newStatus: PathwaySuggestionStatus): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return false;
    }

    try {
      const now = new Date().toISOString();
      
      // Build update object based on new status
      let updatePayload: {
        status: PathwaySuggestionStatus;
        updated_at: string;
        reviewed_at?: string;
        implemented_at?: string;
      } = {
        status: newStatus,
        updated_at: now,
      };

      if (newStatus === "approved" || newStatus === "dismissed" || newStatus === "reviewed") {
        updatePayload = { ...updatePayload, reviewed_at: now };
      }

      if (newStatus === "implemented") {
        updatePayload = { ...updatePayload, implemented_at: now };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("pathway_suggestions")
        .update(updatePayload)
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      // Update local state
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, ...updatePayload }
            : s
        ) as PathwaySuggestion[]
      );

      // Refresh counts
      await Promise.all([fetchStatusCounts(), fetchPendingByPractitioner()]);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      return false;
    }
  }, [fetchStatusCounts, fetchPendingByPractitioner]);

  // Mark all approved suggestions for a practitioner type as implemented
  const markAllImplemented = useCallback(async (type: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("pathway_suggestions")
        .update({
          status: "implemented",
          implemented_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("practitioner_type", type)
        .eq("status", "approved");

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      // Refresh data
      await fetchSuggestions();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      return false;
    }
  }, [fetchSuggestions]);

  // Handle real-time changes - uses refs to avoid recreating the callback
  const handleChange = useCallback(
    (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: PathwaySuggestion | null;
      old: Partial<PathwaySuggestion> | null;
    }) => {
      if (!isMountedRef.current) return;
      
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const { status: currentStatus, practitionerType: currentPractitionerType, 
              suggestionType: currentSuggestionType, severity: currentSeverity } = filtersRef.current;

      console.log(`📡 Pathway suggestion ${eventType}:`, newRecord?.id || oldRecord?.id);

      if (eventType === "INSERT" && newRecord) {
        // Check if matches current filters
        const matchesStatus = currentStatus === "all" || newRecord.status === currentStatus;
        const matchesPractitioner = currentPractitionerType === "all" || newRecord.practitioner_type === currentPractitionerType;
        const matchesSuggestionType = currentSuggestionType === "all" || newRecord.suggestion_type === currentSuggestionType;
        const matchesSeverity = currentSeverity === "all" || newRecord.severity === currentSeverity;

        if (matchesStatus && matchesPractitioner && matchesSuggestionType && matchesSeverity) {
          setSuggestions((prev) => [newRecord, ...prev]);
          setTotal((prev) => prev + 1);
        }
      }

      if (eventType === "UPDATE" && newRecord) {
        setSuggestions((prev) => {
          const index = prev.findIndex((s) => s.id === newRecord.id);
          
          // Check if still matches filters
          const matchesStatus = currentStatus === "all" || newRecord.status === currentStatus;
          const matchesPractitioner = currentPractitionerType === "all" || newRecord.practitioner_type === currentPractitionerType;

          if (index >= 0) {
            if (matchesStatus && matchesPractitioner) {
              const updated = [...prev];
              updated[index] = newRecord;
              return updated;
            } else {
              setTotal((t) => Math.max(0, t - 1));
              return prev.filter((s) => s.id !== newRecord.id);
            }
          } else if (matchesStatus && matchesPractitioner) {
            setTotal((t) => t + 1);
            return [newRecord, ...prev];
          }

          return prev;
        });
      }

      if (eventType === "DELETE" && oldRecord?.id) {
        setSuggestions((prev) => {
          const wasIncluded = prev.some((s) => s.id === oldRecord.id);
          if (wasIncluded) {
            setTotal((t) => Math.max(0, t - 1));
          }
          return prev.filter((s) => s.id !== oldRecord.id);
        });
      }

      // Refresh counts
      fetchStatusCounts();
      fetchPendingByPractitioner();
    },
    [fetchStatusCounts, fetchPendingByPractitioner]
  );

  // Set up real-time subscription - only runs once on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Subscribe to real-time changes
    const channel = supabase
      .channel("pathway_suggestions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pathway_suggestions",
        },
        (payload) => {
          handleChange({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: payload.new as PathwaySuggestion | null,
            old: payload.old as Partial<PathwaySuggestion> | null,
          });
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Suggestions] Subscription status:", subStatus);
        if (isMountedRef.current) {
          const wasConnected = isConnectedRef.current;
          setIsConnected(subStatus === "SUBSCRIBED");
          isConnectedRef.current = subStatus === "SUBSCRIBED";
          
          // If we just connected, trigger a refetch
          if (subStatus === "SUBSCRIBED" && !wasConnected) {
            console.log("[Realtime Suggestions] Connection established, triggering refetch");
            // Small delay to let connection stabilize
            setTimeout(() => {
              if (isMountedRef.current && fetchSuggestionsRef.current) {
                fetchSuggestionsRef.current();
              }
            }, 500);
          }
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Suggestions] Unsubscribing from channel");
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleChange]);

  // Fetch data when filters change - separate from subscription
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return {
    suggestions,
    loading,
    error,
    isConnected,
    refresh: fetchSuggestions,
    updateStatus,
    markAllImplemented,
    statusCounts,
    pendingByPractitioner,
    pagination: {
      total,
    },
  };
}

export default usePathwaySuggestions;
