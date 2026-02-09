"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CallNote } from "@/lib/db/types";

interface UseCallNotesOptions {
  callRecordId?: string;
}

interface UseCallNotesReturn {
  notes: CallNote[];
  loading: boolean;
  error: string | null;
  addNote: (content: string) => Promise<CallNote | null>;
  updateNote: (noteId: string, content: string) => Promise<CallNote | null>;
  deleteNote: (noteId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useCallNotes(options: UseCallNotesOptions = {}): UseCallNotesReturn {
  const { callRecordId } = options;
  
  const [notes, setNotes] = useState<CallNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    if (!callRecordId) {
      setNotes([]);
      return;
    }
    
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/campaign/notes?call_record_id=${callRecordId}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch notes");
      }
      const data = await response.json();
      setNotes(data.notes || []);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error fetching notes:", err);
      setError(String(err));
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [callRecordId]);

  // Add a new note
  const addNote = useCallback(async (content: string): Promise<CallNote | null> => {
    if (!callRecordId) {
      console.error("No callRecordId provided");
      return null;
    }
    
    try {
      const response = await fetch("/api/campaign/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_record_id: callRecordId,
          content,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add note");
      }
      
      const data = await response.json();
      
      // Update local state
      setNotes(prev => [data.note, ...prev]);
      
      return data.note;
    } catch (err) {
      console.error("Error adding note:", err);
      setError(err instanceof Error ? err.message : "Failed to add note");
      return null;
    }
  }, [callRecordId]);

  // Update a note
  const updateNote = useCallback(async (noteId: string, content: string): Promise<CallNote | null> => {
    try {
      const response = await fetch("/api/campaign/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: noteId,
          content,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update note");
      }
      
      const data = await response.json();
      
      // Update local state
      setNotes(prev => prev.map(n => n.id === noteId ? data.note : n));
      
      return data.note;
    } catch (err) {
      console.error("Error updating note:", err);
      setError(err instanceof Error ? err.message : "Failed to update note");
      return null;
    }
  }, []);

  // Delete a note
  const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/campaign/notes?id=${noteId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete note");
      }
      
      // Update local state
      setNotes(prev => prev.filter(n => n.id !== noteId));
      
      return true;
    } catch (err) {
      console.error("Error deleting note:", err);
      setError(err instanceof Error ? err.message : "Failed to delete note");
      return false;
    }
  }, []);

  // Fetch on mount or when callRecordId changes
  useEffect(() => {
    fetchNotes();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchNotes]);

  return {
    notes,
    loading,
    error,
    addNote,
    updateNote,
    deleteNote,
    refetch: fetchNotes,
  };
}

// Hook for recent notes across all calls
export function useRecentNotes(limit = 10) {
  const [notes, setNotes] = useState<CallNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/campaign/notes?recent=${limit}`);
      if (!response.ok) {
        throw new Error("Failed to fetch recent notes");
      }
      const data = await response.json();
      setNotes(data.notes || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching recent notes:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return { notes, loading, error, refetch: fetchNotes };
}

export default useCallNotes;
