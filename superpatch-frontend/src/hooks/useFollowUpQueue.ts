"use client";

/**
 * Hook for fetching and managing follow-up queue items from Supabase
 * 
 * Features:
 * - Fetches LLM-generated follow-up emails/content
 * - Supports status filtering (draft, approved, sent, failed)
 * - Real-time updates via Supabase Realtime
 * - Approve/dismiss/send actions
 * - Retry logic with direct fetch fallback for AbortError handling
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Follow-up queue types
export type FollowUpType = 'email' | 'sms' | 'callback_notes';
export type FollowUpStatus = 'draft' | 'approved' | 'sent' | 'failed';

export interface FollowUpContextData {
  products_mentioned?: string[];
  studies_to_reference?: string[];
  objections_to_address?: string[];
}

export interface FollowUpItem {
  id: string;
  call_record_id: string | null;
  practitioner_id: string | null;
  type: FollowUpType;
  subject: string | null;
  content: string;
  context_data: FollowUpContextData | null;
  status: FollowUpStatus;
  created_at: string;
  sent_at: string | null;
  updated_at: string;
  // Joined data
  practitioner_name?: string;
  practitioner_phone?: string;
  practitioner_email?: string;
}

interface UseFollowUpQueueOptions {
  statusFilter?: FollowUpStatus | "all";
  typeFilter?: FollowUpType | "all";
  limit?: number;
}

interface StatusCounts {
  draft: number;
  approved: number;
  sent: number;
  failed: number;
}

interface UseFollowUpQueueResult {
  items: FollowUpItem[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  updateStatus: (id: string, status: FollowUpStatus) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  statusCounts: StatusCounts;
  pagination: {
    total: number;
  };
}

export function useFollowUpQueue(
  options: UseFollowUpQueueOptions = {}
): UseFollowUpQueueResult {
  const { statusFilter = "all", typeFilter = "all", limit = 50 } = options;

  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    draft: 0,
    approved: 0,
    sent: 0,
    failed: 0,
  });

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const fetchItemsRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Fetch status counts
  const fetchStatusCounts = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("follow_up_queue")
        .select("status");

      if (!isMountedRef.current) return;

      if (error) {
        // Ignore abort errors
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) return;
        console.error("Error fetching status counts:", error);
        return;
      }

      const counts: StatusCounts = {
        draft: 0,
        approved: 0,
        sent: 0,
        failed: 0,
      };

      data?.forEach((item: { status: FollowUpStatus }) => {
        if (item.status in counts) {
          counts[item.status]++;
        }
      });

      setStatusCounts(counts);
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) return;
      if (!isMountedRef.current) return;
      console.error("Error fetching status counts:", err);
    }
  }, []);

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
    params.append('order', 'created_at.desc');
    params.append('limit', limit.toString());
    
    if (statusFilter !== 'all') {
      params.append('status', `eq.${statusFilter}`);
    }
    if (typeFilter !== 'all') {
      params.append('type', `eq.${typeFilter}`);
    }

    const url = `${supabaseUrl}/rest/v1/follow_up_queue?${params.toString()}`;
    console.log('[FollowUpQueue] Using direct fetch fallback:', url);
    
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
  }, [statusFilter, typeFilter, limit]);

  // Fetch follow-up items with retry logic
  const fetchItems = useCallback(async (isRetry = false) => {
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
        .from("follow_up_queue")
        .select(`
          *,
          practitioners:practitioner_id (
            name,
            phone,
            contact_email
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      const { data, error: fetchError, count } = await query;

      console.log('[FollowUpQueue] Fetch result:', { 
        dataLength: data?.length, 
        count, 
        error: fetchError,
        retryCount: retryCountRef.current
      });

      if (!isMountedRef.current) return;

      if (fetchError) {
        const isAbortError = fetchError.message?.includes('AbortError') || fetchError.message?.includes('aborted');
        
        if (isAbortError) {
          console.log('[FollowUpQueue] AbortError in response');
          
          if (data && data.length > 0) {
            // Transform and set data despite abort
            const transformedData = (data || []).map((item: any) => ({
              ...item,
              practitioner_name: item.practitioners?.name,
              practitioner_phone: item.practitioners?.phone,
              practitioner_email: item.practitioners?.contact_email,
            }));
            setItems(transformedData);
            setTotal(count || 0);
            setError(null);
          } else if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(`[FollowUpQueue] Retrying fetch (attempt ${retryCountRef.current}/${maxRetries}) in 1 second...`);
            setTimeout(() => {
              if (isMountedRef.current) {
                fetchItems(true);
              }
            }, 1000);
          } else {
            // Max retries reached - try direct API
            console.log('[FollowUpQueue] Max retries reached, trying direct fetch fallback...');
            try {
              const { data: fallbackData, count: fallbackCount } = await fetchWithDirectAPI();
              if (isMountedRef.current && fallbackData) {
                console.log('[FollowUpQueue] Direct fetch succeeded:', fallbackData.length, 'items');
                setItems(fallbackData as FollowUpItem[]);
                setTotal(fallbackCount || fallbackData.length);
                setError(null);
                await fetchStatusCounts();
              }
            } catch (fallbackErr) {
              console.error('[FollowUpQueue] Direct fetch also failed:', fallbackErr);
              if (isMountedRef.current) {
                setError('Failed to fetch follow-up items. Please try refreshing.');
              }
            }
          }
          return;
        }
        
        setError(fetchError.message);
      } else {
        // Transform data to include practitioner info
        const transformedData = (data || []).map((item: any) => ({
          ...item,
          practitioner_name: item.practitioners?.name,
          practitioner_phone: item.practitioners?.phone,
          practitioner_email: item.practitioners?.contact_email,
        }));
        setItems(transformedData);
        setTotal(count || 0);
        setError(null);
      }

      // Also fetch counts
      await fetchStatusCounts();
    } catch (err) {
      const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
      
      if (isAbortError) {
        if (retryCountRef.current < maxRetries && isMountedRef.current) {
          retryCountRef.current++;
          console.log(`[FollowUpQueue] Retrying fetch (attempt ${retryCountRef.current}/${maxRetries}) in 1 second...`);
          setTimeout(() => {
            if (isMountedRef.current) {
              fetchItems(true);
            }
          }, 1000);
        }
        return;
      }
      
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [statusFilter, typeFilter, limit, fetchStatusCounts, fetchWithDirectAPI]);

  // Update item status
  const updateStatus = useCallback(async (id: string, newStatus: FollowUpStatus): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return false;
    }

    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "sent") {
        updateData.sent_at = new Date().toISOString();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("follow_up_queue")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      // Update local state
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: newStatus, ...updateData } as FollowUpItem
            : item
        )
      );

      // Refresh counts
      await fetchStatusCounts();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      return false;
    }
  }, [fetchStatusCounts]);

  // Delete item
  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from("follow_up_queue")
        .delete()
        .eq("id", id);

      if (deleteError) {
        setError(deleteError.message);
        return false;
      }

      // Update local state
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));

      // Refresh counts
      await fetchStatusCounts();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      return false;
    }
  }, [fetchStatusCounts]);

  // Handle real-time changes
  const handleChange = useCallback(
    (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: FollowUpItem | null;
      old: Partial<FollowUpItem> | null;
    }) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log(`📡 Follow-up queue ${eventType}:`, newRecord?.id || oldRecord?.id);

      if (eventType === "INSERT" && newRecord) {
        const matchesStatus = statusFilter === "all" || newRecord.status === statusFilter;
        const matchesType = typeFilter === "all" || newRecord.type === typeFilter;

        if (matchesStatus && matchesType) {
          setItems((prev) => [newRecord, ...prev]);
          setTotal((prev) => prev + 1);
        }
      }

      if (eventType === "UPDATE" && newRecord) {
        setItems((prev) => {
          const index = prev.findIndex((item) => item.id === newRecord.id);
          const matchesStatus = statusFilter === "all" || newRecord.status === statusFilter;

          if (index >= 0) {
            if (matchesStatus) {
              const updated = [...prev];
              updated[index] = newRecord;
              return updated;
            } else {
              setTotal((t) => Math.max(0, t - 1));
              return prev.filter((item) => item.id !== newRecord.id);
            }
          } else if (matchesStatus) {
            setTotal((t) => t + 1);
            return [newRecord, ...prev];
          }

          return prev;
        });
      }

      if (eventType === "DELETE" && oldRecord?.id) {
        setItems((prev) => {
          const wasIncluded = prev.some((item) => item.id === oldRecord.id);
          if (wasIncluded) {
            setTotal((t) => Math.max(0, t - 1));
          }
          return prev.filter((item) => item.id !== oldRecord.id);
        });
      }

      // Refresh counts
      fetchStatusCounts();
    },
    [statusFilter, typeFilter, fetchStatusCounts]
  );

  // Keep refs in sync
  useEffect(() => {
    fetchItemsRef.current = fetchItems;
  }, [fetchItems]);

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

    // Subscribe to real-time changes
    const channel = supabase
      .channel("follow_up_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follow_up_queue",
        },
        (payload) => {
          if (isMountedRef.current) {
            handleChange({
              eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
              new: payload.new as FollowUpItem | null,
              old: payload.old as Partial<FollowUpItem> | null,
            });
          }
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Follow-up] Subscription status:", subStatus);
        if (isMountedRef.current) {
          const wasConnected = isConnectedRef.current;
          setIsConnected(subStatus === "SUBSCRIBED");
          isConnectedRef.current = subStatus === "SUBSCRIBED";
          
          // If we just connected, trigger a refetch
          if (subStatus === "SUBSCRIBED" && !wasConnected) {
            console.log("[Realtime Follow-up] Connection established, triggering refetch");
            setTimeout(() => {
              if (isMountedRef.current && fetchItemsRef.current) {
                fetchItemsRef.current();
              }
            }, 500);
          }
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Follow-up] Unsubscribing from channel");
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleChange]);

  // Fetch data when filters change - separate from subscription
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    loading,
    error,
    isConnected,
    refresh: fetchItems,
    updateStatus,
    deleteItem,
    statusCounts,
    pagination: {
      total,
    },
  };
}

export default useFollowUpQueue;
