"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Phone,
  PhoneCall,
  MapPin,
  Star,
  Globe,
  ExternalLink,
  Clock,
  Calendar,
  Loader2,
  Users,
  Mail,
  Stethoscope,
  Languages,
  Sparkles,
  Copy,
  CheckCheck,
  Smile,
  Meh,
  Frown,
  MoreHorizontal,
  History,
  FileText,
  Building2,
  Plus,
  Brain,
  UserPlus,
  Edit,
  Ban,
  Trash2,
  Download,
  Linkedin,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CampaignCallRecord,
  getCallRecord,
  createCallRecord,
  saveCallRecord,
  updateCallStatus,
  syncCallRecordToSupabase,
} from "@/lib/campaign-storage";
import { CallStatus } from "@/lib/db/types";
import { getBatchCaller, Practitioner } from "@/lib/batch-caller";
import { LeadScoreGauge } from "./lead-score-gauge";
import { DrawerCallTimeline } from "./drawer-call-timeline";
import { LLMAnalysisPanel } from "./llm-analysis-panel";
import type { LLMAnalysisData, AnalysisStatus } from "@/lib/db/types";
import { toast } from "sonner";

// Enrichment data types
interface EnrichmentPractitioner {
  name: string;
  credentials: string;
  context?: string;
}

interface EnrichmentData {
  scraped_at: string;
  success: boolean;
  data?: {
    url: string;
    title: string;
    description: string;
    practitioners: EnrichmentPractitioner[];
    emails: string[];
    phones: string[];
    services: string[];
    languages: string[];
    raw_text_preview?: string;
  };
}

// LinkedIn profile data
interface LinkedInProfile {
  name: string;
  linkedin_url: string;
  confidence: number;
  title?: string;
  description?: string;
  credentials?: string;
}

interface LinkedInProfiles {
  team_members: LinkedInProfile[];
  enriched_at: string;
  total_found: number;
  total_searched: number;
}

// Qualification data from call conversations
interface QualificationData {
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  decision_maker?: boolean | null;
  best_callback_time?: string | null;
  interest_level?: string | null;
  pain_points?: string | null;
  current_solutions?: string | null;
  objections?: string | null;
  practice_size?: number | null;
  patient_volume?: string | null;
  follow_up_action?: string | null;
  follow_up_date?: string | null;
  decision_timeline?: string | null;
}

interface PractitionerWithEnrichment extends Practitioner {
  enrichment?: EnrichmentData;
  linkedin_profiles?: LinkedInProfiles;
  linkedin_enrichment_status?: string;
  // Qualification fields from calls
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  decision_maker?: boolean | null;
  best_callback_time?: string | null;
  interest_level?: string | null;
  pain_points?: string | null;
  current_solutions?: string | null;
  objections?: string | null;
  practice_size?: number | null;
  patient_volume?: string | null;
  follow_up_action?: string | null;
  follow_up_date?: string | null;
  decision_timeline?: string | null;
}

interface PractitionerDetailDrawerProps {
  practitioner: PractitionerWithEnrichment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCallStarted?: (callId: string) => void;
  /** Called after a practitioner is queued so the parent can refresh records. */
  onQueued?: () => void;
  /** Called after a practitioner's editable fields are saved. */
  onPractitionerUpdated?: (practitioner: PractitionerWithEnrichment) => void;
  /** Called after a practitioner is deleted. */
  onPractitionerDeleted?: (id: string) => void;
}

const STATUS_COLORS: Record<CallStatus, string> = {
  not_called: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  queued: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  booked: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  calendar_sent: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  voicemail: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_LABELS: Record<CallStatus, string> = {
  not_called: "Not Called",
  queued: "Queued",
  in_progress: "In Progress",
  completed: "Completed",
  booked: "Booked",
  calendar_sent: "Calendar Sent",
  voicemail: "Voicemail",
  failed: "Failed",
};

export function PractitionerDetailDrawer({
  practitioner,
  open,
  onOpenChange,
  onCallStarted,
  onQueued,
  onPractitionerUpdated,
  onPractitionerDeleted,
}: PractitionerDetailDrawerProps) {
  const [callRecord, setCallRecord] = useState<CampaignCallRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [blandCalls, setBlandCalls] = useState<any[]>([]);
  const [loadingBlandCalls, setLoadingBlandCalls] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [callIntelligence, setCallIntelligence] = useState<{
    sentiment_label?: string;
    sentiment_score?: number;
    lead_score?: number;
    recording_url?: string;
    // LLM Analysis fields
    llm_analysis?: LLMAnalysisData | null;
    llm_lead_score?: number | null;
    llm_analyzed_at?: string | null;
    analysis_status?: AnalysisStatus | null;
  } | null>(null);
  const [callNotes, setCallNotes] = useState<Array<{
    id: string;
    content: string;
    created_by: string | null;
    created_at: string;
  }>>([]);
  const [showTranscript, setShowTranscript] = useState(false);

  // DNC dialog state
  const [dncDialogOpen, setDncDialogOpen] = useState(false);
  const [dncReason, setDncReason] = useState("");
  const [dncLoading, setDncLoading] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Add-to-queue state
  const [queueLoading, setQueueLoading] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    website: "",
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Helper to copy email to clipboard
  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Get enrichment data
  const enrichment = practitioner?.enrichment?.data;
  const linkedinProfiles = practitioner?.linkedin_profiles;

  // Helper to find LinkedIn profile for a team member by name
  const getLinkedInProfile = (memberName: string): LinkedInProfile | undefined => {
    if (!linkedinProfiles?.team_members) return undefined;
    
    const memberNameLower = memberName.toLowerCase();
    return linkedinProfiles.team_members.find(profile => {
      const profileNameLower = profile.name.toLowerCase();
      // Match if names are similar (handle "Dr. John Smith" vs "John Smith")
      const memberWords = memberNameLower.replace(/^dr\.?\s*/i, '').split(' ');
      const profileWords = profileNameLower.replace(/^dr\.?\s*/i, '').split(' ');
      
      // Check if at least 2 words match
      const matches = memberWords.filter(word => 
        profileWords.some(pWord => pWord.includes(word) || word.includes(pWord))
      );
      return matches.length >= Math.min(2, memberWords.length);
    });
  };

  // Get confidence color for LinkedIn match
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-400 dark:text-gray-500';
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Load call record and Bland API history when practitioner changes
  const loadCallData = useCallback(async () => {
    if (!practitioner) {
      setCallRecord(null);
      setNotes("");
      setBlandCalls([]);
      setCallIntelligence(null);
      setCallNotes([]);
      setShowTranscript(false);
      return;
    }

    // Load call record from API with localStorage fallback
    try {
      const response = await fetch(`/api/campaign/calls?practitioner_id=${practitioner.id}`);
      const data = await response.json();
      
      if (data.record) {
        const record: CampaignCallRecord = {
          practitioner_id: data.record.practitioner_id,
          practitioner_name: data.record.practitioner_name,
          practitioner_type: data.record.practitioner_type || "",
          phone: data.record.phone,
          address: data.record.address || "",
          city: data.record.city || "",
          province: data.record.province || "",
          call_id: data.record.call_id,
          status: data.record.status,
          call_started_at: data.record.call_started_at,
          call_ended_at: data.record.call_ended_at,
          duration_seconds: data.record.duration_seconds,
          transcript: data.record.transcript,
          summary: data.record.summary,
          appointment_booked: data.record.appointment_booked,
          appointment_time: data.record.appointment_time,
          calendar_invite_sent: data.record.calendar_invite_sent,
          practitioner_email: data.record.practitioner_email,
          notes: data.record.notes,
          created_at: data.record.created_at,
          updated_at: data.record.updated_at,
        };
        setCallRecord(record);
        setNotes(record.notes || "");
        
        setCallIntelligence({
          sentiment_label: data.record.sentiment_label,
          sentiment_score: data.record.sentiment_score,
          lead_score: data.record.lead_score,
          recording_url: data.record.recording_url,
          // LLM Analysis fields
          llm_analysis: data.record.llm_analysis,
          llm_lead_score: data.record.llm_lead_score,
          llm_analyzed_at: data.record.llm_analyzed_at,
          analysis_status: data.record.analysis_status,
        });
        
        // Fetch call notes if we have a call record ID
        if (data.record.id) {
          try {
            const notesResponse = await fetch(`/api/campaign/notes?call_record_id=${data.record.id}`);
            const notesData = await notesResponse.json();
            if (notesData.notes) {
              setCallNotes(notesData.notes);
            }
          } catch (err) {
            console.warn('Failed to fetch call notes:', err);
          }
        }
      } else {
        const localRecord = getCallRecord(practitioner.id);
        setCallRecord(localRecord);
        setNotes(localRecord?.notes || "");
      }
    } catch {
      const localRecord = getCallRecord(practitioner.id);
      setCallRecord(localRecord);
      setNotes(localRecord?.notes || "");
    }

    // Load calls from Bland API
    if (practitioner.phone) {
      setLoadingBlandCalls(true);
      try {
        const phoneDigits = practitioner.phone.replace(/\D/g, "");
        const formattedPhone =
          phoneDigits.length === 10
            ? `+1${phoneDigits}`
            : phoneDigits.length === 11 && phoneDigits.startsWith("1")
              ? `+${phoneDigits}`
              : practitioner.phone;

        const response = await fetch(`/api/bland/calls?limit=10`);
        const data = await response.json();

        const matchingCalls = (data.calls || []).filter(
          (call: any) =>
            call.to === formattedPhone ||
            call.to?.replace(/\D/g, "") === phoneDigits
        );

        setBlandCalls(matchingCalls);
      } catch (error) {
        console.error("Failed to load Bland calls:", error);
        setBlandCalls([]);
      }
      setLoadingBlandCalls(false);
    }
  }, [practitioner]);

  useEffect(() => {
    if (open) {
      loadCallData();
      setActiveTab("overview");
    }
  }, [open, practitioner, loadCallData]);

  // Save notes when they change (debounced).
  //
  // Previously this silently fell back to localStorage on API failure, which
  // made operators believe notes synced when they did not (the next operator
  // on a different machine never saw them). The new behavior:
  //   - 2xx response: update local React state, write to localStorage as a
  //     mirror for offline reads.
  //   - non-2xx / network error: keep the local copy in the React state so
  //     the operator can keep typing, surface a toast with the error, and
  //     DO NOT silently overwrite the DB-sourced record with a local-only one.
  useEffect(() => {
    if (!practitioner || !callRecord) return;

    const timeout = setTimeout(async () => {
      if (notes !== callRecord.notes) {
        try {
          const response = await fetch("/api/campaign/calls", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              practitioner_id: practitioner.id,
              notes,
            }),
          });

          if (response.ok) {
            setCallRecord((prev) => (prev ? { ...prev, notes } : null));
            saveCallRecord({ ...callRecord, notes });
          } else {
            const errBody = await response.text().catch(() => "");
            console.error(
              `[practitioner-detail-drawer] notes PATCH failed (${response.status}): ${errBody.slice(0, 200)}`,
            );
            toast.error(
              `Couldn't save note to server (${response.status}). Will retry on next change. Your text is still in this drawer.`,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error("[practitioner-detail-drawer] notes PATCH threw:", err);
          toast.error(
            `Couldn't save note to server (${msg}). Will retry on next change.`,
          );
        }
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [notes, practitioner, callRecord]);

  const handleCallNow = async () => {
    if (!practitioner || !practitioner.phone) return;

    setIsCalling(true);

    try {
      let record = getCallRecord(practitioner.id);
      if (!record) {
        record = createCallRecord({
          id: practitioner.id,
          name: practitioner.name,
          practitioner_type: practitioner.practitioner_type,
          phone: practitioner.phone,
          address: practitioner.address,
          city: practitioner.city,
          province: practitioner.province,
        });
      }

      const batchCaller = getBatchCaller();
      const result = await batchCaller.makeCall(practitioner);

      if (result.success && result.call_id) {
        const updatedRecord = getCallRecord(practitioner.id);
        setCallRecord(updatedRecord);
        onCallStarted?.(result.call_id);
      } else {
        toast.error(`Call failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Call error:", error);
      toast.error("Failed to initiate call");
    }

    setIsCalling(false);
  };

  // Handle marking as Do Not Call
  const handleMarkAsDNC = async () => {
    if (!practitioner || !dncReason.trim()) return;
    
    setDncLoading(true);
    try {
      const response = await fetch(`/api/practitioners/${practitioner.id}/dnc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark',
          reason: dncReason.trim(),
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setDncDialogOpen(false);
        setDncReason("");
        // Close the drawer and let parent refresh
        onOpenChange(false);
      } else {
        toast.error(`Failed to mark as DNC: ${result.error}`);
      }
    } catch (error) {
      console.error("Error marking as DNC:", error);
      toast.error("Failed to mark as Do Not Call");
    }
    setDncLoading(false);
  };

  // Handle restoring from Do Not Call
  const handleRestoreFromDNC = async () => {
    if (!practitioner || !restoreConfirmed) return;
    
    setRestoreLoading(true);
    try {
      const response = await fetch(`/api/practitioners/${practitioner.id}/dnc`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          confirmation: true,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setRestoreDialogOpen(false);
        setRestoreConfirmed(false);
        // Close the drawer and let parent refresh
        onOpenChange(false);
      } else {
        toast.error(`Failed to restore: ${result.error}`);
      }
    } catch (error) {
      console.error("Error restoring from DNC:", error);
      toast.error("Failed to restore practitioner");
    }
    setRestoreLoading(false);
  };

  // Handle adding the practitioner to the call queue (status -> queued)
  const handleAddToQueue = async () => {
    if (!practitioner) return;
    if (practitioner.do_not_call) {
      toast.error("This practitioner is marked Do Not Call");
      return;
    }
    setQueueLoading(true);
    try {
      let record = getCallRecord(practitioner.id);
      if (!record) {
        record = createCallRecord({
          id: practitioner.id,
          name: practitioner.name,
          practitioner_type: practitioner.practitioner_type,
          phone: practitioner.phone || "",
          address: practitioner.address || "",
          city: practitioner.city || "",
          province: practitioner.province || "",
        });
      }
      const queued = updateCallStatus(practitioner.id, "queued");
      const synced = await syncCallRecordToSupabase(queued ?? record);
      if (synced) {
        toast.success(`${practitioner.name} added to queue`);
        onQueued?.();
      } else {
        toast.error("Added locally but failed to sync to the queue");
      }
    } catch (error) {
      console.error("Error adding to queue:", error);
      toast.error("Failed to add to queue");
    }
    setQueueLoading(false);
  };

  // Open the edit dialog, prefilling the current values
  const openEditDialog = () => {
    if (!practitioner) return;
    setEditForm({
      name: practitioner.name ?? "",
      phone: practitioner.phone ?? "",
      address: practitioner.address ?? "",
      city: practitioner.city ?? "",
      province: practitioner.province ?? "",
      website: practitioner.website ?? "",
    });
    setEditDialogOpen(true);
  };

  // Handle saving edited practitioner fields
  const handleEditSave = async () => {
    if (!practitioner) return;
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setEditLoading(true);
    try {
      const response = await fetch(`/api/practitioners/${practitioner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          city: editForm.city.trim() || null,
          province: editForm.province.trim() || null,
          website: editForm.website.trim() || null,
        }),
      });
      const result = await response.json();
      if (response.ok && result.status === "success") {
        toast.success("Practitioner updated");
        setEditDialogOpen(false);
        onPractitionerUpdated?.({ ...practitioner, ...result.data });
      } else {
        toast.error(result.message || "Failed to update practitioner");
      }
    } catch (error) {
      console.error("Error updating practitioner:", error);
      toast.error("Failed to update practitioner");
    }
    setEditLoading(false);
  };

  // Handle deleting the practitioner
  const handleDelete = async () => {
    if (!practitioner) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/practitioners/${practitioner.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (response.ok && result.status === "success") {
        toast.success("Practitioner deleted");
        setDeleteDialogOpen(false);
        onPractitionerDeleted?.(practitioner.id);
        onOpenChange(false);
      } else {
        toast.error(result.message || "Failed to delete practitioner");
      }
    } catch (error) {
      console.error("Error deleting practitioner:", error);
      toast.error("Failed to delete practitioner");
    }
    setDeleteLoading(false);
  };

  if (!practitioner) return null;

  const hasPhone = !!practitioner.phone;
  const canCall =
    hasPhone &&
    !practitioner.do_not_call &&
    (!callRecord ||
      ["not_called", "failed", "completed"].includes(callRecord.status));

  const status = callRecord?.status || "not_called";
  const leadScore = callIntelligence?.lead_score || 0;
  const sentiment = callIntelligence?.sentiment_label;

  // Build timeline items
  const timelineItems = [];
  if (callRecord && callRecord.status !== "not_called" && callRecord.status !== "queued") {
    timelineItems.push({
      id: callRecord.call_id || "local",
      date: callRecord.call_started_at || callRecord.created_at,
      status: callRecord.status,
      duration: callRecord.duration_seconds,
      summary: callRecord.summary,
      transcript: callRecord.transcript,
      recording_url: callIntelligence?.recording_url,
      sentiment_label: callIntelligence?.sentiment_label,
      appointment_booked: callRecord.appointment_booked,
    });
  }
  // Add Bland API calls
  blandCalls.forEach((call) => {
    timelineItems.push({
      id: call.call_id,
      date: call.created_at,
      status: call.status,
      duration: call.call_length,
    });
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] sm:w-[950px] lg:w-[1000px] p-0 flex flex-col z-[1100]" style={{ fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif' }}>
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-semibold">
                {getInitials(practitioner.name)}
              </AvatarFallback>
            </Avatar>

            {/* Name & Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{practitioner.name}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {practitioner.practitioner_type}
              </p>
              
              {/* Badges Row */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge className={STATUS_COLORS[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
                {practitioner.is_user_added && (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400"
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    User Added
                  </Badge>
                )}
                {practitioner.do_not_call && (
                  <Badge
                    variant="outline"
                    className="bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-400"
                    title={practitioner.dnc_reason || "Do Not Call"}
                  >
                    <Ban className="w-3 h-3 mr-1" />
                    Do Not Call
                  </Badge>
                )}
                {enrichment && (
                  <Badge
                    variant="outline"
                    className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/50 dark:to-blue-950/50 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Enriched
                  </Badge>
                )}
                {linkedinProfiles && linkedinProfiles.total_found > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-[#0077B5]/10 border-[#0077B5]/30 text-[#0077B5] dark:bg-[#0077B5]/20"
                  >
                    <Linkedin className="w-3 h-3 mr-1" />
                    {linkedinProfiles.total_found} LinkedIn
                  </Badge>
                )}
                {sentiment && (
                  <Badge
                    variant="secondary"
                    className={
                      sentiment === "positive"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : sentiment === "negative"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }
                  >
                    {sentiment === "positive" && <Smile className="w-3 h-3 mr-1" />}
                    {sentiment === "negative" && <Frown className="w-3 h-3 mr-1" />}
                    {sentiment === "neutral" && <Meh className="w-3 h-3 mr-1" />}
                    {sentiment}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          {leadScore > 0 && (
            <div className="mt-3 pt-3 border-t">
              <LeadScoreGauge score={leadScore} size="md" />
            </div>
          )}
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 px-6">
            <TabsTrigger 
              value="overview" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <History className="w-4 h-4 mr-2" />
              History
              {timelineItems.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                  {timelineItems.length}
                </Badge>
              )}
            </TabsTrigger>
<TabsTrigger
              value="notes"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <FileText className="w-4 h-4 mr-2" />
              Notes
            </TabsTrigger>
            <TabsTrigger
              value="qualification"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Qualification
              {(practitioner?.contact_name || practitioner?.interest_level || practitioner?.decision_maker) && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  <Sparkles className="w-2.5 h-2.5" />
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="ai-analysis"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
            >
              <Brain className="w-4 h-4 mr-2" />
              AI Analysis
              {callIntelligence?.analysis_status === "completed" && callIntelligence?.llm_analysis && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                  <Sparkles className="w-2.5 h-2.5" />
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <ScrollArea className="flex-1 h-0">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 p-6 space-y-4">
              {/* Practice Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Practice Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${practitioner.address}, ${practitioner.city}, ${practitioner.province}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                    >
                      <p className="text-sm group-hover:text-blue-600 group-hover:underline">
                        {practitioner.address}
                      </p>
                      <p className="text-sm text-muted-foreground group-hover:text-blue-500">
                        {practitioner.city}, {practitioner.province}
                      </p>
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm">
                      {practitioner.phone || (
                        <span className="text-muted-foreground">No phone available</span>
                      )}
                    </p>
                  </div>

                  {practitioner.rating && (
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <p className="text-sm">
                        {practitioner.rating} stars
                        {practitioner.review_count && ` (${practitioner.review_count} reviews)`}
                      </p>
                    </div>
                  )}

                  {practitioner.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={practitioner.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Website
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Team Members */}
              {enrichment?.practitioners && enrichment.practitioners.length > 0 && (
                <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between text-purple-700 dark:text-purple-300">
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Team Members ({enrichment.practitioners.length})
                      </span>
                      {linkedinProfiles && linkedinProfiles.total_found > 0 && (
                        <Badge variant="outline" className="bg-[#0077B5]/10 border-[#0077B5]/30 text-[#0077B5] dark:bg-[#0077B5]/20 dark:text-[#0077B5]">
                          <Linkedin className="w-3 h-3 mr-1" />
                          {linkedinProfiles.total_found} LinkedIn
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {enrichment.practitioners.map((prac, idx) => {
                      const linkedinProfile = getLinkedInProfile(prac.name);
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-[10px] bg-purple-100 text-purple-700">
                                {getInitials(prac.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{prac.name}</p>
                              <p className="text-xs text-muted-foreground">{prac.credentials}</p>
                            </div>
                          </div>
                          {linkedinProfile && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={linkedinProfile.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`shrink-0 p-1.5 rounded-md hover:bg-[#0077B5]/10 transition-colors ${getConfidenceColor(linkedinProfile.confidence)}`}
                                  >
                                    <Linkedin className="w-4 h-4" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[280px]">
                                  <div className="space-y-1">
                                    <p className="font-medium text-sm">{linkedinProfile.title || 'LinkedIn Profile'}</p>
                                    {linkedinProfile.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {linkedinProfile.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 pt-1">
                                      <span className={`text-xs font-medium ${getConfidenceColor(linkedinProfile.confidence)}`}>
                                        {Math.round(linkedinProfile.confidence * 100)}% match
                                      </span>
                                      <span className="text-xs text-muted-foreground">•</span>
                                      <span className="text-xs text-muted-foreground">Click to view</span>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Contact Emails */}
              {enrichment?.emails && enrichment.emails.length > 0 && (
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <Mail className="w-4 h-4" />
                      Contact Emails ({enrichment.emails.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {enrichment.emails.map((email, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                        <a
                          href={`mailto:${email}`}
                          className="text-sm text-blue-600 hover:underline truncate"
                        >
                          {email}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => copyEmail(email)}
                        >
                          {copiedEmail === email ? (
                            <CheckCheck className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Services */}
              {enrichment?.services && enrichment.services.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" />
                      Services Offered
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {enrichment.services.map((service, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Languages */}
              {enrichment?.languages && enrichment.languages.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Languages className="w-4 h-4" />
                      Languages Spoken
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {enrichment.languages.map((lang, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="m-0 p-6">
              <DrawerCallTimeline items={timelineItems} loading={loadingBlandCalls} />
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="m-0 p-6 space-y-4">
              {/* Call Summary (read-only) */}
              {callRecord?.summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      AI Call Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {callRecord.summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* AI-Generated Call Notes */}
              {callNotes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Call Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {callNotes.map((note) => (
                      <div key={note.id} className="border-l-2 border-primary/30 pl-3 py-1">
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {note.created_by || "System"} • {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Transcript (collapsible) */}
              {callRecord?.transcript && (
                <Card>
                  <CardHeader className="pb-2">
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="w-full flex items-center justify-between"
                    >
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Call Transcript
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {showTranscript ? "Hide" : "Show"}
                      </span>
                    </button>
                  </CardHeader>
                  {showTranscript && (
                    <CardContent>
                      <ScrollArea className="h-[300px] rounded-md border p-4">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                          {callRecord.transcript}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Your Notes (editable) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Your Notes</Label>
                <Textarea
                  placeholder="Add notes about this practitioner..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[150px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Notes are saved automatically
                </p>
              </div>
            </TabsContent>

            {/* Qualification Tab - Data from AI Calls */}
            <TabsContent value="qualification" className="m-0 p-6 space-y-4">
              {/* Check if we have any qualification data */}
              {!practitioner?.contact_name && !practitioner?.interest_level && !practitioner?.decision_maker && !practitioner?.pain_points && !practitioner?.practice_size ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <UserPlus className="w-10 h-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium">No qualification data yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Qualification data is captured during AI phone calls
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Contact Information */}
                  {(practitioner?.contact_name || practitioner?.contact_role || practitioner?.contact_email) && (
                    <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-300">
                          <Users className="w-4 h-4" />
                          Contact Captured
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {practitioner?.contact_name && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Name</span>
                            <span className="text-sm font-medium">{practitioner.contact_name}</span>
                          </div>
                        )}
                        {practitioner?.contact_role && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Role</span>
                            <Badge variant="outline" className="capitalize">{practitioner.contact_role.replace(/_/g, ' ')}</Badge>
                          </div>
                        )}
                        {practitioner?.contact_email && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Email</span>
                            <a href={`mailto:${practitioner.contact_email}`} className="text-sm text-blue-600 hover:underline">
                              {practitioner.contact_email}
                            </a>
                          </div>
                        )}
                        {practitioner?.decision_maker !== null && practitioner?.decision_maker !== undefined && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Decision Maker</span>
                            <Badge variant={practitioner.decision_maker ? "default" : "secondary"}>
                              {practitioner.decision_maker ? "Yes" : "No"}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Interest & Qualification */}
                  {(practitioner?.interest_level || practitioner?.pain_points || practitioner?.objections) && (
                    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
                          <Sparkles className="w-4 h-4" />
                          Interest & Qualification
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {practitioner?.interest_level && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Interest Level</span>
                            <Badge 
                              variant={practitioner.interest_level === 'high' ? 'default' : practitioner.interest_level === 'medium' ? 'secondary' : 'outline'}
                              className={
                                practitioner.interest_level === 'high' ? 'bg-green-500' :
                                practitioner.interest_level === 'medium' ? 'bg-yellow-500' :
                                practitioner.interest_level === 'low' ? 'bg-orange-500' : 'bg-red-500'
                              }
                            >
                              {practitioner.interest_level.charAt(0).toUpperCase() + practitioner.interest_level.slice(1)}
                            </Badge>
                          </div>
                        )}
                        {practitioner?.pain_points && (
                          <div className="py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground block mb-1">Pain Points</span>
                            <p className="text-sm">{practitioner.pain_points}</p>
                          </div>
                        )}
                        {practitioner?.current_solutions && (
                          <div className="py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground block mb-1">Current Solutions</span>
                            <p className="text-sm">{practitioner.current_solutions}</p>
                          </div>
                        )}
                        {practitioner?.objections && (
                          <div className="py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground block mb-1">Objections Raised</span>
                            <p className="text-sm">{practitioner.objections}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Practice Details */}
                  {(practitioner?.practice_size || practitioner?.patient_volume) && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Practice Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {practitioner?.practice_size && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-muted/50 rounded-md">
                            <span className="text-xs text-muted-foreground">Practice Size</span>
                            <span className="text-sm font-medium">{practitioner.practice_size} practitioners</span>
                          </div>
                        )}
                        {practitioner?.patient_volume && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-muted/50 rounded-md">
                            <span className="text-xs text-muted-foreground">Patient Volume</span>
                            <span className="text-sm font-medium capitalize">{practitioner.patient_volume}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Follow-up Actions */}
                  {(practitioner?.follow_up_action || practitioner?.follow_up_date || practitioner?.best_callback_time || practitioner?.decision_timeline) && (
                    <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-700 dark:text-purple-300">
                          <Calendar className="w-4 h-4" />
                          Next Steps
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {practitioner?.follow_up_action && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Action</span>
                            <Badge variant="outline" className="capitalize">{practitioner.follow_up_action.replace(/_/g, ' ')}</Badge>
                          </div>
                        )}
                        {practitioner?.follow_up_date && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Follow-up Date</span>
                            <span className="text-sm font-medium">
                              {new Date(practitioner.follow_up_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {practitioner?.best_callback_time && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Best Time to Call</span>
                            <span className="text-sm font-medium">{practitioner.best_callback_time}</span>
                          </div>
                        )}
                        {practitioner?.decision_timeline && (
                          <div className="flex items-center justify-between py-1.5 px-2 bg-white/60 dark:bg-white/10 rounded-md">
                            <span className="text-xs text-muted-foreground">Decision Timeline</span>
                            <span className="text-sm font-medium">{practitioner.decision_timeline}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* AI Analysis Tab - LLM-generated insights */}
            <TabsContent value="ai-analysis" className="m-0 p-6 space-y-4">
              <LLMAnalysisPanel
                analysis={callIntelligence?.llm_analysis || null}
                llmLeadScore={callIntelligence?.llm_lead_score || null}
                analysisStatus={callIntelligence?.analysis_status || null}
                analyzedAt={callIntelligence?.llm_analyzed_at || null}
                ruleBasedScore={callIntelligence?.lead_score}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Sticky Action Bar */}
        <div className="sticky bottom-0 border-t bg-background p-4">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Button
                onClick={handleCallNow}
                disabled={!canCall || isCalling}
                title={practitioner.do_not_call ? "Marked Do Not Call" : undefined}
                className="flex-1"
                size="lg"
              >
                {isCalling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calling...
                  </>
                ) : status === "in_progress" ? (
                  <>
                    <PhoneCall className="w-4 h-4 mr-2 animate-pulse" />
                    In Progress
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 mr-2" />
                    Call Now
                  </>
                )}
              </Button>

              {enrichment?.emails && enrichment.emails.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="lg" asChild>
                      <a href={`mailto:${enrichment.emails[0]}`}>
                        <Mail className="w-4 h-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send Email</TooltipContent>
                </Tooltip>
              )}

              {practitioner.website && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="lg" asChild>
                      <a href={practitioner.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open Website</TooltipContent>
                </Tooltip>
              )}

              {linkedinProfiles && linkedinProfiles.total_found > 0 && linkedinProfiles.team_members[0] && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="text-[#0077B5] hover:text-[#0077B5] hover:bg-[#0077B5]/10 border-[#0077B5]/30"
                      asChild
                    >
                      <a 
                        href={linkedinProfiles.team_members[0].linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Linkedin className="w-4 h-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    View LinkedIn ({linkedinProfiles.total_found} profile{linkedinProfiles.total_found > 1 ? 's' : ''})
                  </TooltipContent>
                </Tooltip>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="lg">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem
                    disabled={queueLoading}
                    onClick={handleAddToQueue}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add to Queue
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={async () => {
                      if (practitioner.phone) {
                        await navigator.clipboard.writeText(practitioner.phone);
                      }
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Phone
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={async () => {
                      const address = `${practitioner.address}, ${practitioner.city}, ${practitioner.province}`;
                      await navigator.clipboard.writeText(address);
                    }}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Copy Address
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={openEditDialog}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Practitioner
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      // Export single practitioner to CSV
                      const headers = ["Name", "Type", "Phone", "Address", "City", "Province", "Website", "Rating"];
                      const row = [
                        practitioner.name,
                        practitioner.practitioner_type,
                        practitioner.phone || "",
                        practitioner.address || "",
                        practitioner.city || "",
                        practitioner.province || "",
                        practitioner.website || "",
                        practitioner.rating?.toString() || "",
                      ];
                      const csv = [headers.join(","), row.map(v => `"${v}"`).join(",")].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${practitioner.name.replace(/[^a-z0-9]/gi, "_")}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export to CSV
                  </DropdownMenuItem>
                  
                  {enrichment?.emails && enrichment.emails.length > 0 && (
                    <DropdownMenuItem asChild>
                      <a href={`mailto:${enrichment.emails[0]}`}>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </a>
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />

                  {practitioner.do_not_call ? (
                    <DropdownMenuItem
                      className="text-green-600 focus:text-green-600"
                      onClick={() => setRestoreDialogOpen(true)}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Restore to Active
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-orange-600 focus:text-orange-600"
                      onClick={() => setDncDialogOpen(true)}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Mark as Do Not Call
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Practitioner
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </div>

          {!hasPhone && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Cannot call - no phone number available
            </p>
          )}

          {hasPhone && practitioner.do_not_call && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Marked Do Not Call
            </p>
          )}
        </div>

        {/* Mark as DNC Dialog */}
        <Dialog open={dncDialogOpen} onOpenChange={setDncDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Do Not Call</DialogTitle>
              <DialogDescription>
                This will prevent {practitioner.name} from being called in future campaigns.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="dnc-reason" className="text-sm font-medium">
                Reason for marking as Do Not Call
              </Label>
              <Input
                id="dnc-reason"
                placeholder="e.g., Requested to not be called"
                value={dncReason}
                onChange={(e) => setDncReason(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDncDialogOpen(false);
                  setDncReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleMarkAsDNC}
                disabled={!dncReason.trim() || dncLoading}
              >
                {dncLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Marking...
                  </>
                ) : (
                  "Mark as Do Not Call"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Restore from DNC Dialog */}
        <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore to Active List</DialogTitle>
              <DialogDescription>
                This will remove {practitioner.name} from the Do Not Call list and allow them to be contacted again.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Warning:</strong> Only restore this practitioner if they have explicitly given consent to be contacted again.
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="restore-confirm"
                  checked={restoreConfirmed}
                  onCheckedChange={(checked) => setRestoreConfirmed(checked === true)}
                />
                <label
                  htmlFor="restore-confirm"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  I confirm this practitioner has given consent to be contacted
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRestoreDialogOpen(false);
                  setRestoreConfirmed(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRestoreFromDNC}
                disabled={!restoreConfirmed || restoreLoading}
              >
                {restoreLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  "Restore to Active"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Practitioner Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Practitioner</DialogTitle>
              <DialogDescription>
                Update contact details for {practitioner.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={editForm.city}
                    onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-province">Province</Label>
                  <Input
                    id="edit-province"
                    value={editForm.province}
                    onChange={(e) => setEditForm((f) => ({ ...f, province: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-website">Website</Label>
                <Input
                  id="edit-website"
                  value={editForm.website}
                  onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={editLoading}>
                {editLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Practitioner Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Practitioner</DialogTitle>
              <DialogDescription>
                This permanently removes {practitioner.name} and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
