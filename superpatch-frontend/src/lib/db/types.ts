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

export type AppointmentStatus = 
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export type AppointmentType = 
  | 'demo'
  | 'follow_up'
  | 'in_person'
  | 'other';

export type LocationType = 'in_person' | 'phone' | 'video';

// LLM Analysis status
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// LLM Analysis data structure (stored in llm_analysis JSONB column)
export interface LLMAnalysisData {
  // Structured extraction
  objections_raised?: string[];
  buying_signals?: string[];
  pain_points?: string[];
  products_discussed?: string[];
  decision_maker_spoke?: boolean;
  competitor_mentions?: string[];
  next_steps_agreed?: string | null;
  timeline_mentioned?: string | null;
  budget_discussed?: boolean;
  practice_size_mentioned?: number | null;
  contact_name_extracted?: string | null;
  contact_role_extracted?: string | null;
  email_extracted?: string | null;
  // Lead score reasoning
  lead_score_reasoning?: string;
  // Follow-up content (if generated)
  follow_up?: {
    subject?: string;
    content?: string;
    context_data?: {
      products_mentioned?: string[];
      studies_to_reference?: string[];
      objections_to_address?: string[];
    };
  };
}

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

// User role type
export type UserRole = 'admin' | 'user';

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          invited_by?: string | null;
          updated_at?: string;
        };
      };
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
          // LLM Analysis fields
          llm_analysis: LLMAnalysisData | null;
          llm_lead_score: number | null;
          llm_analyzed_at: string | null;
          analysis_status: AnalysisStatus | null;
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
          // LLM Analysis fields
          llm_analysis?: LLMAnalysisData | null;
          llm_lead_score?: number | null;
          llm_analyzed_at?: string | null;
          analysis_status?: AnalysisStatus | null;
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
          // LLM Analysis fields
          llm_analysis?: LLMAnalysisData | null;
          llm_lead_score?: number | null;
          llm_analyzed_at?: string | null;
          analysis_status?: AnalysisStatus | null;
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
          // Extended analytics columns
          calls_answered: number;
          calls_voicemail: number;
          calls_no_answer: number;
          avg_duration_seconds: number;
          demos_booked: number;
          samples_requested: number;
          high_interest: number;
          medium_interest: number;
          low_interest: number;
          answer_rate: number;
          conversion_rate: number;
          retries_scheduled: number;
          retries_completed: number;
          new_practitioners: number;
          enriched_practitioners: number;
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
          calls_answered?: number;
          calls_voicemail?: number;
          calls_no_answer?: number;
          avg_duration_seconds?: number;
          demos_booked?: number;
          samples_requested?: number;
          high_interest?: number;
          medium_interest?: number;
          low_interest?: number;
          answer_rate?: number;
          conversion_rate?: number;
          retries_scheduled?: number;
          retries_completed?: number;
          new_practitioners?: number;
          enriched_practitioners?: number;
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
          calls_answered?: number;
          calls_voicemail?: number;
          calls_no_answer?: number;
          avg_duration_seconds?: number;
          demos_booked?: number;
          samples_requested?: number;
          high_interest?: number;
          medium_interest?: number;
          low_interest?: number;
          answer_rate?: number;
          conversion_rate?: number;
          retries_scheduled?: number;
          retries_completed?: number;
          new_practitioners?: number;
          enriched_practitioners?: number;
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
          confirmation_sent: boolean;
          confirmation_sent_at: string | null;
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
      practitioners: {
        Row: {
          id: string;
          name: string;
          practitioner_type: string | null;
          address: string | null;
          city: string | null;
          province: string | null;
          country: string | null;
          phone: string | null;
          website: string | null;
          rating: number | null;
          review_count: number | null;
          business_status: string | null;
          google_maps_uri: string | null;
          latitude: number | null;
          longitude: number | null;
          postal_code: string | null;
          scraped_at: string | null;
          notes: string | null;
          enrichment: Json | null;
          enrichment_status: string | null;
          enriched_at: string | null;
          is_user_added: boolean;
          // Qualification columns
          contact_name: string | null;
          contact_role: ContactRole | null;
          contact_email: string | null;
          decision_maker: boolean | null;
          best_callback_time: string | null;
          interest_level: InterestLevel | null;
          pain_points: string | null;
          current_solutions: string | null;
          objections: string | null;
          practice_size: number | null;
          patient_volume: string | null;
          follow_up_action: FollowUpAction | null;
          follow_up_date: string | null;
          decision_timeline: string | null;
          products_interested: string | null;
          wants_sample: boolean | null;
          wants_demo: boolean | null;
          // Retry columns
          retry_count: number;
          next_retry_at: string | null;
          retry_reason: RetryReason | null;
          last_call_status: CallStatus | null;
          last_call_at: string | null;
          // DNC columns
          do_not_call: boolean;
          dnc_reason: string | null;
          dnc_detected_at: string | null;
          dnc_source: 'ai_detected' | 'manual' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          practitioner_type?: string | null;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string | null;
          phone?: string | null;
          website?: string | null;
          rating?: number | null;
          review_count?: number | null;
          business_status?: string | null;
          google_maps_uri?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          postal_code?: string | null;
          notes?: string | null;
          enrichment?: Json | null;
          enrichment_status?: string | null;
          is_user_added?: boolean;
          contact_name?: string | null;
          contact_role?: ContactRole | null;
          contact_email?: string | null;
          decision_maker?: boolean | null;
          interest_level?: InterestLevel | null;
          do_not_call?: boolean;
          dnc_reason?: string | null;
          dnc_source?: 'ai_detected' | 'manual' | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          practitioner_type?: string | null;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string | null;
          phone?: string | null;
          website?: string | null;
          rating?: number | null;
          review_count?: number | null;
          business_status?: string | null;
          notes?: string | null;
          enrichment?: Json | null;
          enrichment_status?: string | null;
          enriched_at?: string | null;
          contact_name?: string | null;
          contact_role?: ContactRole | null;
          contact_email?: string | null;
          decision_maker?: boolean | null;
          best_callback_time?: string | null;
          interest_level?: InterestLevel | null;
          pain_points?: string | null;
          current_solutions?: string | null;
          objections?: string | null;
          practice_size?: number | null;
          patient_volume?: string | null;
          follow_up_action?: FollowUpAction | null;
          follow_up_date?: string | null;
          decision_timeline?: string | null;
          products_interested?: string | null;
          wants_sample?: boolean | null;
          wants_demo?: boolean | null;
          retry_count?: number;
          next_retry_at?: string | null;
          retry_reason?: RetryReason | null;
          last_call_status?: CallStatus | null;
          last_call_at?: string | null;
          do_not_call?: boolean;
          dnc_reason?: string | null;
          dnc_detected_at?: string | null;
          dnc_source?: 'ai_detected' | 'manual' | null;
          updated_at?: string;
        };
      };
      follow_up_queue: {
        Row: {
          id: string;
          call_record_id: string | null;
          practitioner_id: string | null;
          type: 'email' | 'sms' | 'callback_notes';
          subject: string | null;
          content: string;
          context_data: Json | null;
          status: 'draft' | 'approved' | 'sent' | 'failed';
          created_at: string;
          sent_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          call_record_id?: string | null;
          practitioner_id?: string | null;
          type: 'email' | 'sms' | 'callback_notes';
          subject?: string | null;
          content: string;
          context_data?: Json | null;
          status?: 'draft' | 'approved' | 'sent' | 'failed';
          created_at?: string;
          sent_at?: string | null;
          updated_at?: string;
        };
        Update: {
          call_record_id?: string | null;
          practitioner_id?: string | null;
          type?: 'email' | 'sms' | 'callback_notes';
          subject?: string | null;
          content?: string;
          context_data?: Json | null;
          status?: 'draft' | 'approved' | 'sent' | 'failed';
          sent_at?: string | null;
          updated_at?: string;
        };
      };
      pathway_suggestions: {
        Row: {
          id: string;
          call_record_id: string | null;
          practitioner_type: string;
          suggestion_type: PathwaySuggestionType;
          node_id: string | null;
          node_name: string | null;
          edge_id: string | null;
          current_content: string | null;
          suggested_content: string;
          reasoning: string | null;
          transcript_excerpt: string | null;
          severity: PathwaySuggestionSeverity;
          frequency_count: number;
          similar_call_ids: string[];
          status: PathwaySuggestionStatus;
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          implemented_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          call_record_id?: string | null;
          practitioner_type: string;
          suggestion_type: PathwaySuggestionType;
          node_id?: string | null;
          node_name?: string | null;
          edge_id?: string | null;
          current_content?: string | null;
          suggested_content: string;
          reasoning?: string | null;
          transcript_excerpt?: string | null;
          severity?: PathwaySuggestionSeverity;
          frequency_count?: number;
          similar_call_ids?: string[];
          status?: PathwaySuggestionStatus;
        };
        Update: {
          status?: PathwaySuggestionStatus;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          implemented_at?: string | null;
          updated_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          practitioner_id: string | null;
          call_record_id: string | null;
          type: AppointmentType;
          title: string | null;
          scheduled_at: string;
          duration_minutes: number;
          status: AppointmentStatus;
          cal_booking_id: string | null;
          cal_booking_uid: string | null;
          calendar_invite_sent: boolean;
          attendee_name: string | null;
          attendee_email: string | null;
          attendee_phone: string | null;
          location_type: LocationType | null;
          location_address: string | null;
          notes: string | null;
          products_interested: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
        };
        Insert: {
          id?: string;
          practitioner_id?: string | null;
          call_record_id?: string | null;
          type?: AppointmentType;
          title?: string | null;
          scheduled_at: string;
          duration_minutes?: number;
          status?: AppointmentStatus;
          cal_booking_id?: string | null;
          cal_booking_uid?: string | null;
          calendar_invite_sent?: boolean;
          attendee_name?: string | null;
          attendee_email?: string | null;
          attendee_phone?: string | null;
          location_type?: LocationType | null;
          location_address?: string | null;
          notes?: string | null;
          products_interested?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
        Update: {
          id?: string;
          practitioner_id?: string | null;
          call_record_id?: string | null;
          type?: AppointmentType;
          title?: string | null;
          scheduled_at?: string;
          duration_minutes?: number;
          status?: AppointmentStatus;
          cal_booking_id?: string | null;
          cal_booking_uid?: string | null;
          calendar_invite_sent?: boolean;
          attendee_name?: string | null;
          attendee_email?: string | null;
          attendee_phone?: string | null;
          location_type?: LocationType | null;
          location_address?: string | null;
          notes?: string | null;
          products_interested?: string | null;
          updated_at?: string;
          completed_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

export type CallRecord = Database['public']['Tables']['call_records']['Row'];
export type CallRecordInsert = Database['public']['Tables']['call_records']['Insert'];
export type CallRecordUpdate = Database['public']['Tables']['call_records']['Update'];

export type CallNote = Database['public']['Tables']['call_notes']['Row'];
export type CallNoteInsert = Database['public']['Tables']['call_notes']['Insert'];

export type CampaignAnalytics = Database['public']['Tables']['campaign_analytics']['Row'];

export type SampleRequest = Database['public']['Tables']['sample_requests']['Row'];
export type SampleRequestInsert = Database['public']['Tables']['sample_requests']['Insert'];
export type SampleRequestUpdate = Database['public']['Tables']['sample_requests']['Update'];

export type Appointment = Database['public']['Tables']['appointments']['Row'];
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];

export type Practitioner = Database['public']['Tables']['practitioners']['Row'];
export type PractitionerInsert = Database['public']['Tables']['practitioners']['Insert'];
export type PractitionerUpdate = Database['public']['Tables']['practitioners']['Update'];

export type FollowUpQueueItem = Database['public']['Tables']['follow_up_queue']['Row'];
export type FollowUpQueueInsert = Database['public']['Tables']['follow_up_queue']['Insert'];
export type FollowUpQueueUpdate = Database['public']['Tables']['follow_up_queue']['Update'];

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

// Pathway Suggestions types for LLM-generated pathway improvements
export type PathwaySuggestionType = 
  | 'node_prompt'
  | 'edge_label'
  | 'missing_edge'
  | 'missing_node'
  | 'knowledge_base_gap';

export type PathwaySuggestionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type PathwaySuggestionStatus = 'new' | 'approved' | 'reviewed' | 'implemented' | 'dismissed';

export interface PathwaySuggestion {
  id: string;
  call_record_id: string | null;
  practitioner_type: string;
  suggestion_type: PathwaySuggestionType;
  node_id: string | null;
  node_name: string | null;
  edge_id: string | null;
  current_content: string | null;
  suggested_content: string;
  reasoning: string | null;
  transcript_excerpt: string | null;
  severity: PathwaySuggestionSeverity;
  frequency_count: number;
  similar_call_ids: string[];
  status: PathwaySuggestionStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  implemented_at: string | null;
  updated_at: string;
}

export interface PathwaySuggestionInsert {
  id?: string;
  call_record_id?: string | null;
  practitioner_type: string;
  suggestion_type: PathwaySuggestionType;
  node_id?: string | null;
  node_name?: string | null;
  edge_id?: string | null;
  current_content?: string | null;
  suggested_content: string;
  reasoning?: string | null;
  transcript_excerpt?: string | null;
  severity?: PathwaySuggestionSeverity;
  frequency_count?: number;
  similar_call_ids?: string[];
  status?: PathwaySuggestionStatus;
}

export interface PathwaySuggestionUpdate {
  status?: PathwaySuggestionStatus;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  implemented_at?: string | null;
}
