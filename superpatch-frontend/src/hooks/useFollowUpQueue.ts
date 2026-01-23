"use client";

/**
 * Hook for fetching and managing follow-up queue items from Supabase
 * 
 * Features:
 * - Fetches LLM-generated follow-up emails/content
 * - Supports status filtering (draft, approved, sent, failed)
 * - Real-time updates via Supabase Realtime
 * - Approve/dismiss/send actions
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

  // Fetch status counts
  const fetchStatusCounts = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("follow_up_queue")
        .select("status");

      if (error) {
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
      console.error("Error fetching status counts:", err);
    }
  }, []);

  // Fetch follow-up items
  const fetchItems = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
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

      if (fetchError) {
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
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, limit, fetchStatusCounts]);

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

  // Set up real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchItems();

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
          handleChange({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: payload.new as FollowUpItem | null,
            old: payload.old as Partial<FollowUpItem> | null,
          });
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Follow-up] Subscription status:", subStatus);
        setIsConnected(subStatus === "SUBSCRIBED");
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Follow-up] Unsubscribing from channel");
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [fetchItems, handleChange]);

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
