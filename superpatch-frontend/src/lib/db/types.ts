/**
 * Database types for Supabase
 * 
 * These types match the schema defined in supabase/schema.sql
 * In production, you would generate these with: npx supabase gen types typescript
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CallStatus = 
  | 'not_called' 
  | 'queued' 
  | 'in_progress' 
  | 'completed' 
  | 'booked' 
  | 'calendar_sent' 
  | 'failed'
  | 'voicemail';

export type SampleStatus = 'pending' | 'approved' | 'shipped' | 'delivered' | 'cancelled';

export type SampleProduct = 
  | 'freedom'
  | 'liberty' 
  | 'rem'
  | 'focus'
  | 'ignite'
  | 'defend'
  | 'victory'
  | 'kick_it'
  | 'joint_flex';

export type RetryReason = 
  | 'voicemail_left'
  | 'no_answer'
  | 'call_failed'
  | 'busy'
  | 'manual_retry';

// Qualification types for lead scoring
export type InterestLevel = 'high' | 'medium' | 'low' | 'not_interested';

export type ContactRole = 
  | 'owner'
  | 'office_manager'
  | 'receptionist'
  | 'practitioner'
  | 'other';

export type FollowUpAction = 
  | 'send_info'
  | 'callback'
  | 'sample'
  | 'demo'
  | 'none';

// Practitioner qualification data (extracted from calls)
export interface PractitionerQualification {
  // Contact info
  contact_name: string | null;
  contact_role: ContactRole | null;
  contact_email: string | null;
  decision_maker: boolean | null;
  best_callback_time: string | null;
  
  // Interest level
  interest_level: InterestLevel | null;
  pain_points: string | null;
  current_solutions: string | null;
  objections: string | null;
  
  // Business info
  practice_size: number | null;
  patient_volume: string | null;
  
  // Next steps
  follow_up_action: FollowUpAction | null;
  follow_up_date: string | null;
  decision_timeline: string | null;
  
  // Product interest
  products_interested: string | null;
  wants_sample: boolean | null;
  wants_demo: boolean | null;
}

export interface Database {
  public: {
    Tables: {
      call_records: {
        Row: {
          id: string;
          practitioner_id: string | null;  // NULL for unknown callers
          practitioner_name: string;
          practitioner_type: string | null;
          phone: string;
          address: string | null;
          city: string | null;
          province: string | null;
          call_id: string | null;
          status: CallStatus;
          call_started_at: string | null;
          call_ended_at: string | null;
          duration_seconds: number | null;
          transcript: string | null;
          summary: string | null;
          appointment_booked: boolean;
          appointment_time: string | null;
          calendar_invite_sent: boolean;
          practitioner_email: string | null;
          booking_id: string | null;
          notes: string | null;
          sentiment_score: number | null;
          sentiment_label: string | null;
          recording_url: string | null;
          lead_score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          practitioner_id?: string | null;  // Optional - NULL for unknown callers
          practitioner_name: string;
          practitioner_type?: string | null;
          phone: string;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          call_id?: string | null;
          status?: CallStatus;
          call_started_at?: string | null;
          call_ended_at?: string | null;
          duration_seconds?: number | null;
          transcript?: string | null;
          summary?: string | null;
          appointment_booked?: boolean;
          appointment_time?: string | null;
          calendar_invite_sent?: boolean;
          practitioner_email?: string | null;
          booking_id?: string | null;
          notes?: string | null;
          sentiment_score?: number | null;
          sentiment_label?: string | null;
          recording_url?: string | null;
          lead_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          practitioner_id?: string | null;
          practitioner_name?: string;
          practitioner_type?: string | null;
          phone?: string;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          call_id?: string | null;
          status?: CallStatus;
          call_started_at?: string | null;
          call_ended_at?: string | null;
          duration_seconds?: number | null;
          transcript?: string | null;
          summary?: string | null;
          appointment_booked?: boolean;
          appointment_time?: string | null;
          sentiment_score?: number | null;
          sentiment_label?: string | null;
          recording_url?: string | null;
          lead_score?: number;
          calendar_invite_sent?: boolean;
          practitioner_email?: string | null;
          booking_id?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      call_notes: {
        Row: {
          id: string;
          call_record_id: string;
          content: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          call_record_id: string;
          content: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          call_record_id?: string;
          content?: string;
          created_by?: string | null;
        };
      };
      campaign_analytics: {
        Row: {
          id: string;
          date: string;
          total_calls: number;
          completed: number;
          booked: number;
          failed: number;
          total_duration_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          total_calls?: number;
          completed?: number;
          booked?: number;
          failed?: number;
          total_duration_seconds?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          total_calls?: number;
          completed?: number;
          booked?: number;
          failed?: number;
          total_duration_seconds?: number;
        };
      };
      sample_requests: {
        Row: {
          id: string;
          call_record_id: string | null;
          practitioner_id: string | null;
          requester_name: string;
          practice_name: string | null;
          email: string | null;
          phone: string;
          shipping_address: string | null;
          shipping_city: string | null;
          shipping_province: string | null;
          shipping_postal_code: string | null;
          sample_type: string;
          products_requested: string[] | null;
          quantity: number;
          notes: string | null;
          status: SampleStatus;
          tracking_number: string | null;
          shipped_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          call_record_id?: string | null;
          practitioner_id?: string | null;
          requester_name: string;
          practice_name?: string | null;
          email?: string | null;
          phone: string;
          shipping_address?: string | null;
          shipping_city?: string | null;
          shipping_province?: string | null;
          shipping_postal_code?: string | null;
          sample_type?: string;
          products_requested?: string[] | null;
          quantity?: number;
          notes?: string | null;
          status?: SampleStatus;
          tracking_number?: string | null;
          shipped_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          call_record_id?: string | null;
          practitioner_id?: string | null;
          requester_name?: string;
          practice_name?: string | null;
          email?: string | null;
          phone?: string;
          shipping_address?: string | null;
          shipping_city?: string | null;
          shipping_province?: string | null;
          shipping_postal_code?: string | null;
          sample_type?: string;
          products_requested?: string[] | null;
          quantity?: number;
          notes?: string | null;
          status?: SampleStatus;
          tracking_number?: string | null;
          shipped_at?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type CallRecord = Database['public']['Tables']['call_records']['Row'];
export type CallRecordInsert = Database['public']['Tables']['call_records']['Insert'];
export type CallRecordUpdate = Database['public']['Tables']['call_records']['Update'];

export type CallNote = Database['public']['Tables']['call_notes']['Row'];
export type CallNoteInsert = Database['public']['Tables']['call_notes']['Insert'];

export type CampaignAnalytics = Database['public']['Tables']['campaign_analytics']['Row'];

export type SampleRequest = Database['public']['Tables']['sample_requests']['Row'];
export type SampleRequestInsert = Database['public']['Tables']['sample_requests']['Insert'];
export type SampleRequestUpdate = Database['public']['Tables']['sample_requests']['Update'];

// Stats type (computed from call_records)
export interface CampaignStats {
  total_calls: number;
  completed: number;
  booked: number;
  failed: number;
  in_progress: number;
  queued: number;
  not_called: number;
  calendar_sent: number;
  voicemail: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  success_rate: number;
  booking_rate: number;
}

// Retry queue entry (from get_upcoming_retries or get_retry_queue functions)
export interface RetryQueueEntry {
  id: string;
  name: string;
  phone: string;
  practitioner_type: string | null;
  retry_count: number;
  next_retry_at: string;
  retry_reason: RetryReason | null;
  city: string | null;
  province: string | null;
  time_until_retry?: string; // Interval as string from Postgres
}

// Retry policy configuration
export interface RetryPolicy {
  maxAttempts: number;
  retryDelays: number[]; // Minutes: [60, 240, 1440] = 1hr, 4hr, 24hr
  voicemailAction: 'retry' | 'skip' | 'sms_followup';
  failedAction: 'retry' | 'retry_next_business_day' | 'manual_review';
  businessHoursOnly: boolean;
  businessHours: {
    start: number; // 9 = 9am
    end: number;   // 17 = 5pm
    timezone: string;
  };
}

// LinkedIn profile data from Firecrawl enrichment
export interface LinkedInProfile {
  name: string;
  linkedin_url: string;
  confidence: number;
  search_query: string;
  title: string;
  description: string;
  found_at: string;
  credentials?: string;
}

export interface LinkedInProfiles {
  team_members: LinkedInProfile[];
  enriched_at: string;
  total_found: number;
  total_searched: number;
  clinic_url?: string;
}

export type LinkedInEnrichmentStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'no_profiles_found'
  | 'failed'
  | 'skipped';
