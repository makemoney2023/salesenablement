/**
 * Call Notes Database Operations
 * 
 * CRUD operations for call_notes table in Supabase
 */

import { supabase, supabaseAdmin, TypedSupabaseClient } from '../supabase';
import type { CallNote, CallNoteInsert } from './types';

/**
 * Returns the DB client to use for call_notes operations.
 *
 * These functions run server-side (invoked from API routes that already
 * enforce requireApiAuth()). The anon client carries no user JWT, so under
 * is_active_user() RLS its reads return empty and writes fail. Prefer the
 * service-role admin client, falling back to anon only if the service key is
 * not configured.
 */
function getDb(): TypedSupabaseClient | null {
  return supabaseAdmin ?? supabase;
}

/**
 * Get all notes for a call record
 */
export async function getNotesForCall(callRecordId: string): Promise<CallNote[]> {
  const db = getDb();
  if (!db) {
    // No localStorage fallback for notes
    return [];
  }

  const { data, error } = await db
    .from('call_notes')
    .select('*')
    .eq('call_record_id', callRecordId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch call notes:', error);
    return [];
  }

  return (data || []) as CallNote[];
}

/**
 * Add a note to a call record
 */
export async function addNote(note: CallNoteInsert): Promise<CallNote | null> {
  const db = getDb();
  if (!db) {
    console.warn('Supabase not configured, cannot add note');
    return null;
  }

  const { data, error } = await db
    .from('call_notes')
    .insert(note as any)
    .select()
    .single();

  if (error) {
    console.error('Failed to add call note:', error);
    return null;
  }

  return data as CallNote;
}

/**
 * Update a note
 */
export async function updateNote(noteId: string, content: string): Promise<CallNote | null> {
  const db = getDb();
  if (!db) {
    console.warn('Supabase not configured, cannot update note');
    return null;
  }

  const { data, error } = await db
    .from('call_notes')
    // @ts-expect-error - Supabase types need to be generated for full type safety
    .update({ content })
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update call note:', error);
    return null;
  }

  return data as CallNote;
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    console.warn('Supabase not configured, cannot delete note');
    return false;
  }

  const { error } = await db
    .from('call_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    console.error('Failed to delete call note:', error);
    return false;
  }

  return true;
}

/**
 * Get recent notes across all calls
 */
export async function getRecentNotes(limit = 10): Promise<CallNote[]> {
  const db = getDb();
  if (!db) {
    return [];
  }

  const { data, error } = await db
    .from('call_notes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch recent notes:', error);
    return [];
  }

  return (data || []) as CallNote[];
}

/**
 * Get notes count for a call record
 */
export async function getNotesCount(callRecordId: string): Promise<number> {
  const db = getDb();
  if (!db) {
    return 0;
  }

  const { count, error } = await db
    .from('call_notes')
    .select('*', { count: 'exact', head: true })
    .eq('call_record_id', callRecordId);

  if (error) {
    console.error('Failed to count call notes:', error);
    return 0;
  }

  return count || 0;
}
