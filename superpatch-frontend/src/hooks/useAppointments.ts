"use client";

/**
 * Hook for fetching and managing appointments from Supabase
 * 
 * Features:
 * - Fetches appointments with filtering by date range and status
 * - Real-time updates via Supabase Realtime
 * - Status update actions (confirm, complete, cancel, reschedule)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Appointment, AppointmentStatus, AppointmentInsert, AppointmentUpdate } from "@/lib/db/types";

interface UseAppointmentsOptions {
  statusFilter?: AppointmentStatus | "all";
  startDate?: Date;
  endDate?: Date;
  practitionerId?: string;
  limit?: number;
}

interface StatusCounts {
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
  rescheduled: number;
}

export interface AppointmentWithPractitioner extends Appointment {
  practitioners?: {
    name: string;
    phone: string;
    practitioner_type: string | null;
    city: string | null;
    province: string | null;
  } | null;
}

interface UseAppointmentsResult {
  appointments: AppointmentWithPractitioner[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  updateStatus: (id: string, status: AppointmentStatus, additionalData?: Partial<AppointmentUpdate>) => Promise<boolean>;
  createAppointment: (data: AppointmentInsert) => Promise<Appointment | null>;
  deleteAppointment: (id: string) => Promise<boolean>;
  statusCounts: StatusCounts;
  pagination: {
    total: number;
  };
}

export function useAppointments(
  options: UseAppointmentsOptions = {}
): UseAppointmentsResult {
  const {
    statusFilter = "all",
    startDate,
    endDate,
    practitionerId,
    limit = 100,
  } = options;

  const [appointments, setAppointments] = useState<AppointmentWithPractitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    scheduled: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    rescheduled: 0,
  });

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const isMountedRef = useRef(true);

  // Fetch status counts
  const fetchStatusCounts = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("appointments")
        .select("status");

      if (!isMountedRef.current) return;

      if (error) {
        // Ignore abort errors
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) return;
        console.error("Error fetching status counts:", error);
        return;
      }

      const counts: StatusCounts = {
        scheduled: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        rescheduled: 0,
      };

      data?.forEach((item: { status: AppointmentStatus }) => {
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

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("appointments")
        .select(`
          *,
          practitioners:practitioner_id (
            name,
            phone,
            practitioner_type,
            city,
            province
          )
        `, { count: "exact" })
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (startDate) {
        query = query.gte("scheduled_at", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("scheduled_at", endDate.toISOString());
      }

      if (practitionerId) {
        query = query.eq("practitioner_id", practitionerId);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setAppointments(data || []);
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
  }, [statusFilter, startDate, endDate, practitionerId, limit, fetchStatusCounts]);

  // Update appointment status
  const updateStatus = useCallback(async (
    id: string,
    newStatus: AppointmentStatus,
    additionalData?: Partial<AppointmentUpdate>
  ): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return false;
    }

    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...additionalData,
      };

      // Set timestamps based on status
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("appointments")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      // Update local state
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === id
            ? { ...apt, status: newStatus, ...updateData } as AppointmentWithPractitioner
            : apt
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

  // Create new appointment
  const createAppointment = useCallback(async (data: AppointmentInsert): Promise<Appointment | null> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newApt, error: createError } = await (supabase as any)
        .from("appointments")
        .insert(data)
        .select()
        .single();

      if (createError) {
        setError(createError.message);
        return null;
      }

      // Refresh list
      await fetchAppointments();

      return newApt;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
      return null;
    }
  }, [fetchAppointments]);

  // Delete appointment
  const deleteAppointment = useCallback(async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from("appointments")
        .delete()
        .eq("id", id);

      if (deleteError) {
        setError(deleteError.message);
        return false;
      }

      // Update local state
      setAppointments((prev) => prev.filter((apt) => apt.id !== id));
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
      new: Appointment | null;
      old: Partial<Appointment> | null;
    }) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log(`📡 Appointments ${eventType}:`, newRecord?.id || oldRecord?.id);

      if (eventType === "INSERT" && newRecord) {
        // Refresh to get practitioner join data
        fetchAppointments();
      }

      if (eventType === "UPDATE" && newRecord) {
        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === newRecord.id
              ? { ...apt, ...newRecord }
              : apt
          )
        );
      }

      if (eventType === "DELETE" && oldRecord?.id) {
        setAppointments((prev) => prev.filter((apt) => apt.id !== oldRecord.id));
        setTotal((t) => Math.max(0, t - 1));
      }

      // Refresh counts
      fetchStatusCounts();
    },
    [fetchAppointments, fetchStatusCounts]
  );

  // Set up real-time subscription
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchAppointments();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("appointments_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          if (isMountedRef.current) {
            handleChange({
              eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
              new: payload.new as Appointment | null,
              old: payload.old as Partial<Appointment> | null,
            });
          }
        }
      )
      .subscribe((subStatus) => {
        console.log("[Realtime Appointments] Subscription status:", subStatus);
        if (isMountedRef.current) {
          setIsConnected(subStatus === "SUBSCRIBED");
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log("[Realtime Appointments] Unsubscribing from channel");
      isMountedRef.current = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchAppointments, handleChange]);

  return {
    appointments,
    loading,
    error,
    isConnected,
    refresh: fetchAppointments,
    updateStatus,
    createAppointment,
    deleteAppointment,
    statusCounts,
    pagination: {
      total,
    },
  };
}

export default useAppointments;
