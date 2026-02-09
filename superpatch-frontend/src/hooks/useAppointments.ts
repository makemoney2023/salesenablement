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
import { useRetryTimeouts } from "@/hooks/useRetryTimeout";

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
  const isConnectedRef = useRef(false);
  const fetchAppointmentsRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const scheduleRetry = useRetryTimeouts();

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

  // Direct fetch fallback when Supabase client fails
  const fetchWithDirectAPI = useCallback(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const params = new URLSearchParams();
    params.append('select', '*');
    params.append('order', 'scheduled_at.asc');
    params.append('limit', limit.toString());
    
    if (statusFilter !== 'all') {
      params.append('status', `eq.${statusFilter}`);
    }
    if (startDate) {
      params.append('scheduled_at', `gte.${startDate.toISOString()}`);
    }
    if (endDate) {
      params.append('scheduled_at', `lte.${endDate.toISOString()}`);
    }
    if (practitionerId) {
      params.append('practitioner_id', `eq.${practitionerId}`);
    }

    const url = `${supabaseUrl}/rest/v1/appointments?${params.toString()}`;
    console.log('[Appointments] Using direct fetch fallback:', url);
    
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
  }, [statusFilter, startDate, endDate, practitionerId, limit]);

  // Fetch appointments with retry logic
  const fetchAppointments = useCallback(async (isRetry = false) => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    if (!isRetry) {
      retryCountRef.current = 0;
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

      console.log('[Appointments] Fetch result:', { 
        dataLength: data?.length, 
        count, 
        error: fetchError,
        retryCount: retryCountRef.current
      });

      if (!isMountedRef.current) return;

      if (fetchError) {
        const isAbortError = fetchError.message?.includes('AbortError') || fetchError.message?.includes('aborted');
        
        if (isAbortError) {
          console.log('[Appointments] AbortError in response');
          
          if (data && data.length > 0) {
            setAppointments(data || []);
            setTotal(count || 0);
            setError(null);
          } else if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(`[Appointments] Retrying fetch (attempt ${retryCountRef.current}/${maxRetries}) in 1 second...`);
            scheduleRetry(() => {
              if (isMountedRef.current) {
                fetchAppointments(true);
              }
            }, 1000);
          } else {
            console.log('[Appointments] Max retries reached, trying direct fetch fallback...');
            try {
              const { data: fallbackData, count: fallbackCount } = await fetchWithDirectAPI();
              if (isMountedRef.current && fallbackData) {
                console.log('[Appointments] Direct fetch succeeded:', fallbackData.length, 'items');
                setAppointments(fallbackData as AppointmentWithPractitioner[]);
                setTotal(fallbackCount || fallbackData.length);
                setError(null);
                await fetchStatusCounts();
              }
            } catch (fallbackErr) {
              console.error('[Appointments] Direct fetch also failed:', fallbackErr);
              if (isMountedRef.current) {
                setError('Failed to fetch appointments. Please try refreshing.');
              }
            }
          }
          return;
        }
        
        setError(fetchError.message);
      } else {
        setAppointments(data || []);
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
          console.log(`[Appointments] Retrying fetch (attempt ${retryCountRef.current}/${maxRetries}) in 1 second...`);
          scheduleRetry(() => {
            if (isMountedRef.current) {
              fetchAppointments(true);
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
  }, [statusFilter, startDate, endDate, practitionerId, limit, fetchStatusCounts, fetchWithDirectAPI, scheduleRetry]);

  // Direct API update fallback
  const updateWithDirectAPI = useCallback(async (id: string, updateData: Record<string, unknown>): Promise<boolean> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return false;

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(updateData),
      });

      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Update appointment status with retry logic
  const updateStatus = useCallback(async (
    id: string,
    newStatus: AppointmentStatus,
    additionalData?: Partial<AppointmentUpdate>
  ): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return false;
    }

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

    // Retry logic for AbortError
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("appointments")
          .update(updateData)
          .eq("id", id);

        if (updateError) {
          const isAbortError = updateError.message?.includes('AbortError') || updateError.message?.includes('aborted');
          
          if (isAbortError) {
            if (attempt < maxRetries) {
              console.log(`[Appointments] Update retry (attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
            // Fall back to direct API
            console.log('[Appointments] Using direct API for update...');
            const success = await updateWithDirectAPI(id, updateData);
            if (success) {
              setAppointments((prev) =>
                prev.map((apt) =>
                  apt.id === id
                    ? { ...apt, status: newStatus, ...updateData } as AppointmentWithPractitioner
                    : apt
                )
              );
              await fetchStatusCounts();
              return true;
            }
            return false;
          }
          
          setError(updateError.message);
          return false;
        }

        // Success - update local state
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
        const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
        
        if (isAbortError && attempt < maxRetries) {
          console.log(`[Appointments] Update retry (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        
        if (!isMountedRef.current) return false;
        setError(err instanceof Error ? err.message : "Failed to update");
        return false;
      }
    }
    
    return false;
  }, [fetchStatusCounts, updateWithDirectAPI]);

  // Direct API create fallback
  const createWithDirectAPI = useCallback(async (data: AppointmentInsert): Promise<Appointment | null> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return null;

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/appointments`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) return null;
      const result = await response.json();
      return Array.isArray(result) ? result[0] : result;
    } catch {
      return null;
    }
  }, []);

  // Create new appointment with retry logic
  const createAppointment = useCallback(async (data: AppointmentInsert): Promise<Appointment | null> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return null;
    }

    // Retry logic for AbortError
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newApt, error: createError } = await (supabase as any)
          .from("appointments")
          .insert(data)
          .select()
          .single();

        if (createError) {
          const isAbortError = createError.message?.includes('AbortError') || createError.message?.includes('aborted');
          
          if (isAbortError) {
            if (attempt < maxRetries) {
              console.log(`[Appointments] Create retry (attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
            // Fall back to direct API
            console.log('[Appointments] Using direct API for create...');
            const result = await createWithDirectAPI(data);
            if (result) {
              await fetchAppointments();
              return result;
            }
            return null;
          }
          
          setError(createError.message);
          return null;
        }

        // Refresh list
        await fetchAppointments();
        return newApt;
      } catch (err) {
        const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
        
        if (isAbortError && attempt < maxRetries) {
          console.log(`[Appointments] Create retry (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        
        if (!isMountedRef.current) return null;
        setError(err instanceof Error ? err.message : "Failed to create");
        return null;
      }
    }
    
    return null;
  }, [fetchAppointments, createWithDirectAPI]);

  // Direct API delete fallback
  const deleteWithDirectAPI = useCallback(async (id: string): Promise<boolean> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return false;

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Delete appointment with retry logic
  const deleteAppointment = useCallback(async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      return false;
    }

    // Retry logic for AbortError
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteError } = await (supabase as any)
          .from("appointments")
          .delete()
          .eq("id", id);

        if (deleteError) {
          const isAbortError = deleteError.message?.includes('AbortError') || deleteError.message?.includes('aborted');
          
          if (isAbortError) {
            if (attempt < maxRetries) {
              console.log(`[Appointments] Delete retry (attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
            // Fall back to direct API
            console.log('[Appointments] Using direct API for delete...');
            const success = await deleteWithDirectAPI(id);
            if (success) {
              setAppointments((prev) => prev.filter((apt) => apt.id !== id));
              setTotal((prev) => Math.max(0, prev - 1));
              await fetchStatusCounts();
              return true;
            }
            return false;
          }
          
          setError(deleteError.message);
          return false;
        }

        // Success - update local state
        setAppointments((prev) => prev.filter((apt) => apt.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));

        // Refresh counts
        await fetchStatusCounts();
        return true;
      } catch (err) {
        const isAbortError = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'));
        
        if (isAbortError && attempt < maxRetries) {
          console.log(`[Appointments] Delete retry (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        
        if (!isMountedRef.current) return false;
        setError(err instanceof Error ? err.message : "Failed to delete");
        return false;
      }
    }
    
    return false;
  }, [fetchStatusCounts, deleteWithDirectAPI]);

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

  // Keep refs in sync
  useEffect(() => {
    fetchAppointmentsRef.current = fetchAppointments;
  }, [fetchAppointments]);

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
          const wasConnected = isConnectedRef.current;
          setIsConnected(subStatus === "SUBSCRIBED");
          isConnectedRef.current = subStatus === "SUBSCRIBED";
          
          // If we just connected, trigger a refetch
          if (subStatus === "SUBSCRIBED" && !wasConnected) {
            console.log("[Realtime Appointments] Connection established, triggering refetch");
            scheduleRetry(() => {
              if (isMountedRef.current && fetchAppointmentsRef.current) {
                fetchAppointmentsRef.current();
              }
            }, 500);
          }
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
  }, [handleChange, scheduleRetry]);

  // Fetch data when filters change - separate from subscription
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

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
