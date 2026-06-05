"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";

// Simple debounce hook for search input
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
import { useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PhoneCall, Users, Star,
  Search, Play, Pause, Square,
  Clock, Loader2, Download, RefreshCw,
  ListChecks, BarChart3, Phone, Zap,
  PanelLeftClose, PanelLeft, Filter, Kanban, MapPin, History, Package,
  Smile, Meh, Frown, TrendingUp, Globe2, Sparkles, Radio, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import {
  createCallRecord,
  syncCallRecordToSupabase,
  reconcileStaleInProgressRecords,
  exportRecords,
} from "@/lib/campaign-storage";
import { CallStatus } from "@/lib/db/types";
import { useSupabaseCallRecords } from "@/hooks/useSupabaseCallRecords";
// Sample requests moved to standalone /campaign/samples page
import { useRealtimePractitioners } from "@/hooks/useRealtimePractitioners";
import { useRealtimeRetryQueue } from "@/hooks/useRealtimeRetryQueue";
import { KPICards } from "@/components/campaign/kpi-cards";
import { FilterPanel, FilterState, FilterSheet, FilterSheetTrigger } from "@/components/campaign/filter-panel";
import { PipelineBoard, FunnelView } from "@/components/campaign/pipeline-board";
import { AnalyticsDashboard } from "@/components/campaign/analytics-dashboard";
import { ActivityFeed, ActivityFeedCompact } from "@/components/campaign/activity-feed";
import { 
  ColumnVisibilityMenu, 
  SortableHeader,
  RowActionsMenu,
  useTableState,
  DEFAULT_COLUMNS,
  SortState,
} from "@/components/campaign/data-table-toolbar";
import { CommandSearch, useCommandSearch, CommandSearchTrigger } from "@/components/campaign/command-search";
import { callNotifications } from "@/components/campaign/call-notifications";
import { getBatchCaller, Practitioner, BatchCallerEvent } from "@/lib/batch-caller";
import { PractitionerDetailDrawer } from "@/components/campaign/practitioner-detail-drawer";
import { CallTimeline } from "@/components/campaign/call-timeline";
import { 
  NoPractitionersFound, 
  NoCallsYet, 
  NoAnalyticsData, 
  NoPipelineData, 
  NoMapData,
  QueueEmpty 
} from "@/components/campaign/empty-states";
import { 
  GaugeChart, 
  RadialProgressChart, 
  StatCard, 
  KPIGrid 
} from "@/components/campaign/enhanced-charts";
import { PractitionerSearchTab } from "@/components/campaign/practitioner-search-tab";
import { ActiveCallsMonitor } from "@/components/campaign/active-calls-monitor";
import { RetryQueuePanel } from "@/components/campaign/retry-queue-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { QuickCallTab } from "@/components/campaign/quick-call-tab";
import dynamic from "next/dynamic";

// Dynamically import map to avoid SSR issues with Leaflet
const PractitionerMap = dynamic(
  () => import("@/components/campaign/practitioner-map").then(mod => mod.PractitionerMap),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> }
);

// Enrichment data from Firecrawl scraping
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

interface PractitionerData extends Practitioner {
  website: string | null;
  rating: number | null;
  review_count: number | null;
  business_status: string;
  google_maps_uri: string;
  latitude: number;
  longitude: number;
  scraped_at: string;
  notes: string;
  // Enrichment data
  enrichment?: EnrichmentData;
  // User-added flag
  is_user_added?: boolean;
  // Do Not Call fields
  do_not_call?: boolean;
  dnc_reason?: string | null;
  dnc_detected_at?: string | null;
  dnc_source?: 'ai_detected' | 'manual' | null;
  // Qualification data from AI calls
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

interface FilterMetadata {
  countries: string[];
  provinces: string[];
  cities: Record<string, string[]>;
  types: string[];
  provincesByCountry: Record<string, string[]>;
}

interface PaginatedResponse {
  practitioners: PractitionerData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const STATUS_COLORS: Record<CallStatus, string> = {
  not_called: 'bg-gray-100 text-gray-800',
  queued: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  booked: 'bg-purple-100 text-purple-800',
  calendar_sent: 'bg-teal-100 text-teal-800',
  failed: 'bg-red-100 text-red-800',
  voicemail: 'bg-orange-100 text-orange-800',
};

const STATUS_LABELS: Record<CallStatus, string> = {
  not_called: 'Not Called',
  queued: 'Queued',
  in_progress: 'In Progress',
  completed: 'Completed',
  booked: 'Booked',
  calendar_sent: 'Calendar Sent',
  failed: 'Failed',
  voicemail: 'Voicemail',
};

function CampaignPageContent() {
  const searchParams = useSearchParams();
  
  // Data state
  const [practitioners, setPractitioners] = useState<PractitionerData[]>([]);
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, hasMore: false });

  // Filter state
  const [country, setCountry] = useState<string>("");
  const [province, setProvince] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [practitionerType, setPractitionerType] = useState<string>("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [minRating, setMinRating] = useState<string>("");
  const [hasPhoneOnly, setHasPhoneOnly] = useState(true);
  const [hasWebsiteOnly, setHasWebsiteOnly] = useState(false);
  const [callStatusFilter, setCallStatusFilter] = useState<CallStatus[]>([]);
  const [minReviews, setMinReviews] = useState(0);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Enrichment filters
  const [hasEnrichment, setHasEnrichment] = useState(false);
  const [hasEmails, setHasEmails] = useState(false);
  const [hasTeamMembers, setHasTeamMembers] = useState(false);
  const [isMultilingual, setIsMultilingual] = useState(false);
  // User-added filter
  const [showUserAddedOnly, setShowUserAddedOnly] = useState(false);
  // Do Not Call filter
  const [hideDNC, setHideDNC] = useState(true); // Default: hide DNC practitioners
  const [showDNCOnly, setShowDNCOnly] = useState(false);

  // Table state - column visibility and sorting
  const { columns, sortState, toggleColumn, resetColumns, handleSort, visibleColumns } = useTableState();
  
  // Command search state
  const commandSearch = useCommandSearch();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Campaign state
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignPaused, setCampaignPaused] = useState(false);
  const [, setCurrentCallId] = useState<string | null>(null);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  
  // Use Supabase for call records with realtime updates
  const { 
    records: callRecords, 
    stats, 
    refresh: refreshCallRecords,
    isConnected: isRealtimeConnected 
  } = useSupabaseCallRecords();

  // Detail drawer state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedPractitioner, setSelectedPractitioner] = useState<PractitionerData | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState("practitioners");

  // Real-time practitioners hook for enrichment status
  const {
    stats: enrichmentStats,
    isConnected: practitionersConnected,
    refresh: refreshEnrichmentStats,
  } = useRealtimePractitioners({
    onEnrichmentComplete: (practitioner) => {
      console.log(`✅ Enrichment complete: ${practitioner.name}`);
    },
    onEnrichmentFailed: (practitioner) => {
      console.log(`❌ Enrichment failed: ${practitioner.name}`);
    },
  });

  // Real-time retry queue hook
  const {
    queue: retryQueue,
    loading: retryQueueLoading,
    stats: retryStats,
    isConnected: retryQueueConnected,
    refresh: refreshRetryQueue,
  } = useRealtimeRetryQueue({
    hoursAhead: 24,
    limit: 50,
  });

  // Map state - track if all practitioners are loaded
  const [allPractitionersLoaded, setAllPractitionersLoaded] = useState(false);
  const [loadingAllPractitioners, setLoadingAllPractitioners] = useState(false);

  // Bulk enrichment state
  const [isEnrichingBulk, setIsEnrichingBulk] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0, currentName: "" });

  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const batchCaller = useRef(getBatchCaller());
  const refreshTimeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Schedule delayed call record refreshes (with cleanup tracking)
  const scheduleCallRecordRefreshes = useCallback(() => {
    // Clear any pending refresh timeouts before scheduling new ones
    refreshTimeoutIds.current.forEach(id => clearTimeout(id));
    refreshTimeoutIds.current = [];
    // Schedule refreshes to catch webhook data after call completes
    // Calls typically last 30s-3min, so refresh at key intervals
    refreshTimeoutIds.current.push(setTimeout(() => loadCallRecords(), 30000));  // 30 seconds
    refreshTimeoutIds.current.push(setTimeout(() => loadCallRecords(), 60000));  // 1 minute
    refreshTimeoutIds.current.push(setTimeout(() => loadCallRecords(), 120000)); // 2 minutes
  }, []);

  // Cleanup refresh timeouts on unmount
  useEffect(() => {
    const timeouts = refreshTimeoutIds.current;
    return () => {
      timeouts.forEach(id => clearTimeout(id));
    };
  }, []);

  // Load practitioners function
  const loadPractitioners = useCallback(async (page: number) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '100');
      
      if (country) params.set('country', country);
      if (province) params.set('province', province);
      if (city) params.set('city', city);
      if (practitionerType) params.set('type', practitionerType);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (minRating) params.set('minRating', minRating);
      if (hasPhoneOnly) params.set('hasPhone', 'true');

      const response = await fetch(`/api/practitioners?${params}`);
      const data: PaginatedResponse = await response.json();

      if (page === 1) {
        setPractitioners(data.practitioners);
      } else {
        setPractitioners(prev => [...prev, ...data.practitioners]);
      }

      setPagination({
        page: data.pagination.page,
        total: data.pagination.total,
        hasMore: data.pagination.hasMore,
      });
    } catch (error) {
      console.error('Failed to load practitioners:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [country, province, city, practitionerType, debouncedSearch, minRating, hasPhoneOnly]);

  // Load metadata on mount (call records are loaded by useSupabaseCallRecords hook)
  // Also reconcile any stale in_progress records left over from a previous session
  useEffect(() => {
    loadMetadata();
    reconcileStaleInProgressRecords().then(({ reconciled }) => {
      if (reconciled > 0) loadCallRecords();
    });

    // Re-reconcile when user returns to the tab (catches calls that completed while away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reconcileStaleInProgressRecords().then(({ reconciled }) => {
          if (reconciled > 0) loadCallRecords();
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Handle tab query parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "quick-call" || tabParam === "practitioners") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Load practitioners when filters change
  useEffect(() => {
    loadPractitioners(1);
    setAllPractitionersLoaded(false); // Reset when filters change
  }, [loadPractitioners]);

  // Debounced search handled by loadPractitioners dependency

  // Subscribe to batch caller events
  useEffect(() => {
    const unsubscribe = batchCaller.current.subscribe((event: BatchCallerEvent) => {
      loadCallRecords();
      
      switch (event.type) {
        case 'call_started':
          setCurrentCallId(event.call_id || null);
          break;
        case 'call_completed':
        case 'call_failed':
          setCurrentCallId(null);
          break;
        case 'queue_empty':
        case 'campaign_stopped':
          setCampaignRunning(false);
          setCampaignPaused(false);
          setCurrentCallId(null);
          break;
        case 'campaign_paused':
          setCampaignPaused(true);
          break;
      }
    });
    
    return unsubscribe;
  }, []);

  async function loadMetadata() {
    try {
      const response = await fetch('/api/practitioners?metadata=true');
      const data = await response.json();
      setMetadata(data);
    } catch (error) {
      console.error('Failed to load metadata:', error);
    }
  }

  // Refresh call records from Supabase
  function loadCallRecords() {
    refreshCallRecords();
  }

  function loadMorePractitioners() {
    if (pagination.hasMore && !loadingMore) {
      loadPractitioners(pagination.page + 1);
    }
  }

  // Load all practitioners for map view (with pagination to bypass Supabase 1000 row limit)
  async function loadAllPractitioners() {
    if (allPractitionersLoaded || loadingAllPractitioners) {
      console.log('[Map] Skipping load - already loaded:', allPractitionersLoaded);
      return;
    }
    
    setLoadingAllPractitioners(true);
    
    try {
      const baseParams = new URLSearchParams();
      // For map view, DON'T apply location filters (country/province/city)
      // This ensures we see ALL practitioners across US and Canada
      if (practitionerType) baseParams.set('type', practitionerType);
      if (search) baseParams.set('search', search);
      if (minRating) baseParams.set('minRating', minRating);
      if (hasPhoneOnly) baseParams.set('hasPhone', 'true');
      
      console.log('[Map] Loading all practitioners with pagination...');
      
      // Fetch in batches of 1000 (Supabase default limit)
      const batchSize = 1000;
      let allPractitioners: PractitionerData[] = [];
      let page = 1;
      let hasMore = true;
      let totalCount = 0;
      
      while (hasMore) {
        const params = new URLSearchParams(baseParams);
        params.set('page', page.toString());
        params.set('limit', batchSize.toString());
        
        const response = await fetch(`/api/practitioners?${params}`);
        const data: PaginatedResponse = await response.json();
        
        allPractitioners = [...allPractitioners, ...data.practitioners];
        totalCount = data.pagination.total;
        hasMore = data.pagination.hasMore;
        
        console.log(`[Map] Batch ${page}: fetched ${data.practitioners.length}, total so far: ${allPractitioners.length}/${totalCount}`);
        
        page++;
        
        // Safety limit to prevent infinite loops
        if (page > 50) {
          console.warn('[Map] Hit safety limit of 50 batches');
          break;
        }
      }
      
      // Count US vs CA practitioners
      const usCount = allPractitioners.filter((p: any) => p.country === 'US').length;
      const caCount = allPractitioners.filter((p: any) => p.country === 'CA').length;
      console.log('[Map] Loaded all practitioners - Total:', allPractitioners.length, 'US:', usCount, 'CA:', caCount);
      
      setPractitioners(allPractitioners);
      setPagination({
        page: 1,
        total: totalCount,
        hasMore: false,
      });
      setAllPractitionersLoaded(true);
    } catch (error) {
      console.error('Failed to load all practitioners:', error);
    } finally {
      setLoadingAllPractitioners(false);
    }
  }

  // Get available cities for selected province
  const availableCities = useMemo(() => {
    if (!metadata || !province) return [];
    return metadata.cities[province] || [];
  }, [metadata, province]);

  // Client-side filtering and sorting for practitioner data
  const filteredPractitioners = useMemo(() => {
    let result = [...practitioners];
    
    // Apply enrichment filters (client-side since this data isn't in the API)
    if (hasEnrichment) {
      result = result.filter(p => p.enrichment?.success && p.enrichment?.data);
    }
    if (hasEmails) {
      result = result.filter(p => p.enrichment?.data?.emails && p.enrichment.data.emails.length > 0);
    }
    if (hasTeamMembers) {
      result = result.filter(p => p.enrichment?.data?.practitioners && p.enrichment.data.practitioners.length > 0);
    }
    if (isMultilingual) {
      result = result.filter(p => p.enrichment?.data?.languages && p.enrichment.data.languages.length > 1);
    }
    if (showUserAddedOnly) {
      result = result.filter(p => p.is_user_added === true);
    }
    // Do Not Call filters
    if (hideDNC) {
      result = result.filter(p => p.do_not_call !== true);
    }
    if (showDNCOnly) {
      result = result.filter(p => p.do_not_call === true);
    }

    // Apply sorting
    if (sortState.column && sortState.direction) {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortState.column) {
          case "name":
            aValue = a.name?.toLowerCase() || "";
            bValue = b.name?.toLowerCase() || "";
            break;
          case "type":
            aValue = a.practitioner_type?.toLowerCase() || "";
            bValue = b.practitioner_type?.toLowerCase() || "";
            break;
          case "city":
            aValue = a.city?.toLowerCase() || "";
            bValue = b.city?.toLowerCase() || "";
            break;
          case "province":
            aValue = a.province?.toLowerCase() || "";
            bValue = b.province?.toLowerCase() || "";
            break;
          case "rating":
            aValue = a.rating || 0;
            bValue = b.rating || 0;
            break;
          case "reviews":
            aValue = a.review_count || 0;
            bValue = b.review_count || 0;
            break;
          case "enriched":
            // Sort by enrichment status (enriched first when asc)
            aValue = a.enrichment?.success ? 1 : 0;
            bValue = b.enrichment?.success ? 1 : 0;
            break;
          case "source":
            // Sort by source (user-added first when asc)
            aValue = a.is_user_added ? 1 : 0;
            bValue = b.is_user_added ? 1 : 0;
            break;
          case "lastCalled":
            // Sort by last call date (most recent first when desc)
            const aLastCall = callRecords[a.id]?.call_ended_at || callRecords[a.id]?.call_started_at || callRecords[a.id]?.updated_at;
            const bLastCall = callRecords[b.id]?.call_ended_at || callRecords[b.id]?.call_started_at || callRecords[b.id]?.updated_at;
            aValue = aLastCall ? new Date(aLastCall).getTime() : 0;
            bValue = bLastCall ? new Date(bLastCall).getTime() : 0;
            break;
          case "callCount":
            // Sort by call count
            aValue = callRecords[a.id] ? 1 : 0;
            bValue = callRecords[b.id] ? 1 : 0;
            break;
          case "duration":
            // Sort by call duration
            aValue = callRecords[a.id]?.duration_seconds || 0;
            bValue = callRecords[b.id]?.duration_seconds || 0;
            break;
          case "voicemail":
            // Sort by voicemail status (voicemail first when asc)
            aValue = callRecords[a.id]?.status === 'voicemail' ? 1 : 0;
            bValue = callRecords[b.id]?.status === 'voicemail' ? 1 : 0;
            break;
          case "appointment":
            // Sort by appointment time (earliest first when asc)
            const aAppt = callRecords[a.id]?.appointment_time;
            const bAppt = callRecords[b.id]?.appointment_time;
            aValue = aAppt ? new Date(aAppt).getTime() : 0;
            bValue = bAppt ? new Date(bAppt).getTime() : 0;
            break;
          case "status":
            // Get call status
            const aStatus = callRecords[a.id]?.status || "not_called";
            const bStatus = callRecords[b.id]?.status || "not_called";
            // Define order: booked > calendar_sent > completed > in_progress > queued > voicemail > failed > not_called
            const statusOrder: Record<string, number> = {
              booked: 8, calendar_sent: 7, completed: 6, in_progress: 5, 
              queued: 4, voicemail: 3, failed: 2, not_called: 1
            };
            aValue = statusOrder[aStatus] || 0;
            bValue = statusOrder[bStatus] || 0;
            break;
          default:
            return 0;
        }
        
        // Compare values
        if (aValue < bValue) return sortState.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortState.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [practitioners, hasEnrichment, hasEmails, hasTeamMembers, isMultilingual, showUserAddedOnly, hideDNC, showDNCOnly, sortState, callRecords]);

  // Virtual list setup
  const rowVirtualizer = useVirtualizer({
    count: filteredPractitioners.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44, // Reduced from 56px for more compact view
    overscan: 20,
  });

  // Handle checkbox click for selection
  const handleCheckboxClick = useCallback((practitioner: PractitionerData, index: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click
    
    const newSelected = new Set(selectedIds);
    
    if (event.shiftKey && lastSelectedIndex !== null) {
      // Range selection - use filteredPractitioners to match displayed rows
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      for (let i = start; i <= end; i++) {
        if (filteredPractitioners[i]) {
          newSelected.add(filteredPractitioners[i].id);
        }
      }
    } else {
      // Toggle single
      if (newSelected.has(practitioner.id)) {
        newSelected.delete(practitioner.id);
      } else {
        newSelected.add(practitioner.id);
      }
    }
    
    setSelectedIds(newSelected);
    setLastSelectedIndex(index);
  }, [selectedIds, lastSelectedIndex, filteredPractitioners]);

  // Handle row click to open detail drawer
  const handleRowClick = useCallback((practitioner: PractitionerData) => {
    setSelectedPractitioner(practitioner);
    setDetailDrawerOpen(true);
  }, []);

  // Select all visible
  const selectAll = () => {
    const newSelected = new Set(practitioners.map(p => p.id));
    setSelectedIds(newSelected);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  };

  // Get call status for a practitioner
  const getCallStatus = (practitionerId: string): CallStatus => {
    const record = callRecords[practitionerId];
    return record?.status || 'not_called';
  };

  // Get last call date for a practitioner
  const getLastCallDate = (practitionerId: string): string | null => {
    const record = callRecords[practitionerId];
    return record?.call_ended_at || record?.call_started_at || record?.updated_at || null;
  };

  // Get call count for a practitioner
  const getCallCount = (practitionerId: string): number => {
    const record = callRecords[practitionerId];
    return record ? 1 : 0; // Currently tracking single record per practitioner
  };

  // Get call duration for a practitioner
  const getCallDuration = (practitionerId: string): number | null => {
    const record = callRecords[practitionerId];
    return record?.duration_seconds || null;
  };

  // Check if voicemail was left
  const hasVoicemail = (practitionerId: string): boolean => {
    const record = callRecords[practitionerId];
    return record?.status === 'voicemail';
  };

  // Get appointment time for a practitioner
  const getAppointmentTime = (practitionerId: string): string | null => {
    const record = callRecords[practitionerId];
    return record?.appointment_time || null;
  };

  // Get call summary for a practitioner
  const getCallSummary = (practitionerId: string): string | null => {
    const record = callRecords[practitionerId];
    return record?.summary || null;
  };

  // Get sentiment label for a practitioner
  const getSentimentLabel = (practitionerId: string): string | null => {
    const record = callRecords[practitionerId];
    return record?.sentiment_label || null;
  };

  // Get lead score for a practitioner
  const getLeadScore = (practitionerId: string): number => {
    const record = callRecords[practitionerId];
    return record?.lead_score || 0;
  };

  // Format relative time (e.g., "2h ago", "3d ago")
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  // Format duration in mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format appointment date/time compactly
  const formatAppointment = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${timeStr}`;
  };

  // Start campaign with selected practitioners
  const startCampaign = async () => {
    const selectedPractitioners = practitioners.filter(p => selectedIds.has(p.id) && p.phone);
    
    if (selectedPractitioners.length === 0) {
      toast.warning('Please select practitioners with phone numbers');
      return;
    }

    // Create call records for selected practitioners
    for (const p of selectedPractitioners) {
      if (!callRecords[p.id]) {
        createCallRecord({
          id: p.id,
          name: p.name,
          practitioner_type: p.practitioner_type,
          phone: p.phone || '',
          address: p.address,
          city: p.city,
          province: p.province,
        });
      }
    }

    loadCallRecords();
    setCampaignRunning(true);
    setCampaignPaused(false);
    setQueueDrawerOpen(true);
    
    // Show campaign started notification
    callNotifications.campaignStarted(selectedPractitioners.length);
    
    await batchCaller.current.startCampaign(selectedPractitioners);
  };

  // Pause campaign
  const pauseCampaign = () => {
    batchCaller.current.pauseCampaign();
    setCampaignPaused(true);
    callNotifications.campaignPaused();
  };

  // Resume campaign
  const resumeCampaign = () => {
    const selectedPractitioners = practitioners.filter(p => selectedIds.has(p.id) && p.phone);
    batchCaller.current.resumeCampaign(selectedPractitioners);
    setCampaignPaused(false);
  };

  // Stop campaign
  const stopCampaign = () => {
    batchCaller.current.stopCampaign();
    setCampaignRunning(false);
    setCampaignPaused(false);
    // Count booked appointments from current campaign
    const bookedCount = Object.values(callRecords).filter(
      r => r.status === 'booked' || r.status === 'calendar_sent'
    ).length;
    callNotifications.campaignCompleted(bookedCount);
  };

  // Bulk enrich selected practitioners using Supabase Edge Function
  const bulkEnrichSelected = async () => {
    // Get selected practitioners with websites that need enrichment
    const toEnrich = practitioners.filter(
      p => selectedIds.has(p.id) && p.website && (!p.enrichment || p.enrichment?.data === null)
    );

    if (toEnrich.length === 0) {
      toast.warning("No selected practitioners need enrichment (must have website and not already enriched)");
      return;
    }

    setIsEnrichingBulk(true);
    setEnrichmentProgress({ current: 0, total: toEnrich.length, currentName: "Sending to enrichment service..." });

    try {
      // Call Supabase Edge Function for parallel enrichment (up to 50 concurrent)
      const practitionerIds = toEnrich.map(p => p.id);
      
      console.log(`[Bulk Enrich] Invoking edge function for ${practitionerIds.length} practitioners`);
      
      // Use fetch to call the edge function directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase not configured");
      }

      setEnrichmentProgress({ 
        current: 0, 
        total: toEnrich.length, 
        currentName: `Processing ${toEnrich.length} practitioners in parallel...` 
      });

      const response = await fetch(`${supabaseUrl}/functions/v1/enrich-practitioners-v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ practitionerIds }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Edge function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log(`[Bulk Enrich] Edge function result:`, result);

      const successCount = result.enriched || 0;
      const failCount = result.failed || 0;

      setEnrichmentProgress({ 
        current: toEnrich.length, 
        total: toEnrich.length, 
        currentName: "Complete!" 
      });

      // Refresh data to get updated enrichment status
      loadPractitioners(1);
      
      toast.success(`Enrichment complete! ${successCount} succeeded, ${failCount} failed`);
    } catch (err) {
      console.error("[Bulk Enrich] Error:", err);
      toast.error(`Enrichment failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsEnrichingBulk(false);
      setEnrichmentProgress({ current: 0, total: 0, currentName: "" });
    }
  };

  // Export data
  const handleExport = () => {
    const data = exportRecords();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle call started from detail drawer
  const handleCallStarted = (callId: string) => {
    loadCallRecords();
    scheduleCallRecordRefreshes();
    setQueueDrawerOpen(true);
    if (selectedPractitioner) {
      callNotifications.started(selectedPractitioner.name);
    }
    console.log('Call started:', callId);
  };

  // Handle quick call to a practitioner
  const handleQuickCall = (practitioner: PractitionerData) => {
    setSelectedPractitioner(practitioner);
    setDetailDrawerOpen(true);
    // The actual call will be initiated from the detail drawer
  };

  // Stats come from useSupabaseCallRecords hook

  // Filter state object for FilterPanel
  const filterState: FilterState = {
    search,
    country,
    province,
    city,
    practitionerType,
    minRating,
    hasPhoneOnly,
    hasWebsiteOnly,
    callStatus: callStatusFilter,
    minReviews,
    hasEnrichment,
    hasEmails,
    hasTeamMembers,
    isMultilingual,
    showUserAddedOnly,
    hideDNC,
    showDNCOnly,
  };

  // Handle filter changes from FilterPanel
  const handleFilterChange = (changes: Partial<FilterState>) => {
    if (changes.search !== undefined) setSearch(changes.search);
    if (changes.country !== undefined) {
      setCountry(changes.country);
      // Reset province and city when country changes
      if (!changes.province) setProvince("");
      if (!changes.city) setCity("");
    }
    if (changes.province !== undefined) {
      setProvince(changes.province);
      if (!changes.city) setCity("");
    }
    if (changes.city !== undefined) setCity(changes.city);
    if (changes.practitionerType !== undefined) setPractitionerType(changes.practitionerType);
    if (changes.minRating !== undefined) setMinRating(changes.minRating);
    if (changes.hasPhoneOnly !== undefined) setHasPhoneOnly(changes.hasPhoneOnly);
    if (changes.hasWebsiteOnly !== undefined) setHasWebsiteOnly(changes.hasWebsiteOnly);
    if (changes.callStatus !== undefined) setCallStatusFilter(changes.callStatus);
    if (changes.minReviews !== undefined) setMinReviews(changes.minReviews);
    // Enrichment filters
    if (changes.hasEnrichment !== undefined) setHasEnrichment(changes.hasEnrichment);
    if (changes.hasEmails !== undefined) setHasEmails(changes.hasEmails);
    if (changes.hasTeamMembers !== undefined) setHasTeamMembers(changes.hasTeamMembers);
    if (changes.isMultilingual !== undefined) setIsMultilingual(changes.isMultilingual);
    if (changes.showUserAddedOnly !== undefined) setShowUserAddedOnly(changes.showUserAddedOnly);
    // DNC filters
    if (changes.hideDNC !== undefined) setHideDNC(changes.hideDNC);
    if (changes.showDNCOnly !== undefined) setShowDNCOnly(changes.showDNCOnly);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearch("");
    setCountry("");
    setProvince("");
    setCity("");
    setPractitionerType("");
    setMinRating("");
    setHasPhoneOnly(true);
    setHasWebsiteOnly(false);
    setCallStatusFilter([]);
    setMinReviews(0);
    setHasEnrichment(false);
    setHasEmails(false);
    setHasTeamMembers(false);
    setIsMultilingual(false);
    setShowUserAddedOnly(false);
    setHideDNC(true); // Reset to default (hide DNC)
    setShowDNCOnly(false);
  };

  // Count active filters
  const activeFilterCount = [
    search,
    country,
    province,
    city,
    practitionerType,
    minRating,
    !hasPhoneOnly, // Default is true, so only count if false
    hasWebsiteOnly,
    callStatusFilter.length > 0,
    minReviews > 0,
    hasEnrichment,
    hasEmails,
    hasTeamMembers,
    isMultilingual,
    showUserAddedOnly,
    !hideDNC, // Count if DNC is NOT hidden (showing DNC)
    showDNCOnly,
  ].filter(Boolean).length;

  // Get queued/active calls
  const queuedCalls = Object.values(callRecords).filter(r => r.status === 'queued');
  const activeCalls = Object.values(callRecords).filter(r => r.status === 'in_progress');
  const recentCalls = Object.values(callRecords)
    .filter(r => ['completed', 'booked', 'calendar_sent', 'failed'].includes(r.status))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className="hidden lg:flex"
            >
              {filterPanelOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6" />
                Call Center
              </h1>
              <p className="text-muted-foreground text-sm">
                {pagination.total.toLocaleString()} practitioners in database
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Global Search Trigger */}
            <CommandSearchTrigger onClick={() => commandSearch.setOpen(true)} />
            
            {/* Mobile Filter Trigger */}
            <div className="lg:hidden">
              <FilterSheetTrigger
                activeFilterCount={activeFilterCount}
                onClick={() => setFilterSheetOpen(true)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Sheet open={queueDrawerOpen} onOpenChange={setQueueDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <ListChecks className="w-4 h-4 mr-2" />
                  Call Queue
                  {(queuedCalls.length + activeCalls.length) > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {queuedCalls.length + activeCalls.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] p-0">
                <SheetHeader className="p-6 pb-0">
                  <SheetTitle>Call Queue & Activity</SheetTitle>
                  <SheetDescription>
                    Monitor active calls and recent activity
                  </SheetDescription>
                </SheetHeader>
                <Tabs defaultValue="queue" className="mt-4">
                  <div className="px-6">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="queue" className="gap-1 text-xs">
                        <ListChecks className="w-3.5 h-3.5" />
                        Queue
                        {(queuedCalls.length + activeCalls.length) > 0 && (
                          <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                            {queuedCalls.length + activeCalls.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="live" className="gap-1 text-xs">
                        <Radio className="w-3.5 h-3.5" />
                        Live
                      </TabsTrigger>
                      <TabsTrigger value="retries" className="gap-1 text-xs">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retries
                      </TabsTrigger>
                      <TabsTrigger value="activity" className="gap-1 text-xs">
                        <BarChart3 className="w-3.5 h-3.5" />
                        Activity
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="queue" className="mt-4 px-6 pb-6">
                    <div className="space-y-4">
                      {/* Active Call */}
                      {activeCalls.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <PhoneCall className="w-4 h-4 text-blue-500" />
                            Active Call
                          </h4>
                          {activeCalls.map(call => (
                            <Card key={call.practitioner_id} className="border-blue-200 bg-blue-50">
                              <CardContent className="p-3">
                                <p className="font-medium">{call.practitioner_name}</p>
                                <p className="text-sm text-muted-foreground">{call.phone}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Started: {new Date(call.call_started_at!).toLocaleTimeString()}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* Queued Calls */}
                      {queuedCalls.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-yellow-500" />
                            Queued ({queuedCalls.length})
                          </h4>
                          <ScrollArea className="h-[200px]">
                            {queuedCalls.map(call => (
                              <div key={call.practitioner_id} className="flex items-center justify-between py-2 border-b">
                                <div>
                                  <p className="text-sm font-medium">{call.practitioner_name}</p>
                                  <p className="text-xs text-muted-foreground">{call.city}, {call.province}</p>
                                </div>
                                <Badge variant="outline" className="bg-yellow-50">Queued</Badge>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      )}

                      {/* Recent Calls Summary */}
                      {recentCalls.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Recent ({recentCalls.length})
                          </h4>
                          <ScrollArea className="h-[250px]">
                            {recentCalls.map(call => (
                              <div key={call.practitioner_id} className="py-2 border-b">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium">{call.practitioner_name}</p>
                                  <Badge className={STATUS_COLORS[call.status]}>
                                    {STATUS_LABELS[call.status]}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : 'N/A'}
                                  {call.appointment_booked && ' • Appointment booked'}
                                </p>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      )}

                      {queuedCalls.length === 0 && activeCalls.length === 0 && recentCalls.length === 0 && (
                        <QueueEmpty 
                          onAddPractitioners={() => setActiveTab("practitioners")}
                        />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="live" className="mt-0 px-4 pb-4">
                    <ActiveCallsMonitor />
                  </TabsContent>

                  <TabsContent value="retries" className="mt-0 px-4 pb-4">
                    <RetryQueuePanel />
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0 h-[calc(100vh-200px)]">
                    <ActivityFeed
                      records={callRecords}
                      onItemClick={(record) => {
                        const practitioner = practitioners.find(p => p.id === record.practitioner_id);
                        if (practitioner) {
                          setSelectedPractitioner(practitioner);
                          setDetailDrawerOpen(true);
                        }
                      }}
                      autoRefresh
                    />
                  </TabsContent>
                </Tabs>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* KPI Cards Dashboard */}
      <div className="border-b px-6 py-4 bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Campaign Overview</h3>
            {isRealtimeConnected && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                Live
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadCallRecords()}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </div>
        <KPICards 
          stats={stats}
          callsToday={Object.values(callRecords).filter(r => {
            const today = new Date().toDateString();
            return new Date(r.created_at).toDateString() === today;
          }).length}
          callsYesterday={Object.values(callRecords).filter(r => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return new Date(r.created_at).toDateString() === yesterday.toDateString();
          }).length}
        />
      </div>

      {/* Main Content Area with Filter Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Filter Panel Sidebar - Desktop */}
        {filterPanelOpen && (
          <div className="hidden lg:flex w-72 border-r bg-muted/20 p-4 flex-shrink-0 overflow-hidden">
            <FilterPanel
              metadata={metadata}
              filters={filterState}
              onFilterChange={handleFilterChange}
              onClearAll={clearAllFilters}
            />
          </div>
        )}

        {/* Mobile Filter Sheet */}
        <FilterSheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          metadata={metadata}
          filters={filterState}
          onFilterChange={handleFilterChange}
          onClearAll={clearAllFilters}
          practitionerCount={pagination.total}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b px-6">
            <TabsList className="h-12">
              <TabsTrigger value="practitioners" className="gap-2">
                <Users className="w-4 h-4" />
                Practitioner List
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="gap-2">
                <Kanban className="w-4 h-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="quick-call" className="gap-2">
                <Zap className="w-4 h-4" />
                Quick Call
              </TabsTrigger>
              <TabsTrigger value="map" className="gap-2">
                <MapPin className="w-4 h-4" />
                Map
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-2">
                <History className="w-4 h-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="retries" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Retries
                {retryStats.dueNow > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                    {retryStats.dueNow}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-2">
                <Globe2 className="w-4 h-4" />
                Search New
              </TabsTrigger>
            </TabsList>
          </div>

        {/* Practitioner List Tab */}
        <TabsContent value="practitioners" className="flex-1 flex flex-col overflow-hidden m-0">
        <ErrorBoundary section="Practitioner List">
          {/* Filters */}
      <div className="border-b px-6 py-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <Label className="text-xs mb-1 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="w-[180px]">
            <Label className="text-xs mb-1 block">Province</Label>
            <Select value={province || "_all"} onValueChange={(v) => { setProvince(v === "_all" ? "" : v); setCity(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="All provinces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All provinces</SelectItem>
                {metadata?.provinces.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <Label className="text-xs mb-1 block">City</Label>
            <Select value={city || "_all"} onValueChange={(v) => setCity(v === "_all" ? "" : v)} disabled={!province}>
              <SelectTrigger>
                <SelectValue placeholder={province ? "Select city" : "Select province first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All cities</SelectItem>
                {availableCities.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <Label className="text-xs mb-1 block">Type</Label>
            <Select value={practitionerType || "_all"} onValueChange={(v) => setPractitionerType(v === "_all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All types</SelectItem>
                {metadata?.types.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[120px]">
            <Label className="text-xs mb-1 block">Min Rating</Label>
            <Select value={minRating || "_all"} onValueChange={(v) => setMinRating(v === "_all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Any rating</SelectItem>
                <SelectItem value="3">3+ stars</SelectItem>
                <SelectItem value="4">4+ stars</SelectItem>
                <SelectItem value="4.5">4.5+ stars</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Column Visibility */}
          <ColumnVisibilityMenu 
            columns={columns} 
            onToggleColumn={toggleColumn} 
          />

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setProvince("");
              setCity("");
              setPractitionerType("");
              setSearch("");
              setMinRating("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Table Header */}
          <div className="flex items-center px-6 py-2 border-b bg-muted/50 data-table-header text-muted-foreground">
            {visibleColumns.find(c => c.id === "select") && (
              <div className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all practitioners"
                  checked={selectedIds.size > 0 && selectedIds.size === practitioners.length}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  className="rounded"
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "name") && (
              <div className="flex-1 min-w-[200px]">
                <SortableHeader 
                  column={columns.find(c => c.id === "name")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "type") && (
              <div className="w-[140px]">
                <SortableHeader 
                  column={columns.find(c => c.id === "type")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "city") && (
              <div className="w-[120px]">
                <SortableHeader 
                  column={columns.find(c => c.id === "city")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "province") && (
              <div className="w-[100px]">
                <SortableHeader 
                  column={columns.find(c => c.id === "province")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "rating") && (
              <div className="w-[80px] text-center">
                <SortableHeader 
                  column={columns.find(c => c.id === "rating")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "reviews") && (
              <div className="w-[80px] text-center">
                <SortableHeader 
                  column={columns.find(c => c.id === "reviews")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "phone") && (
              <div className="w-[120px]">Phone</div>
            )}
            {visibleColumns.find(c => c.id === "enriched") && (
              <div className="w-[90px] text-center">
                <SortableHeader
                  column={columns.find(c => c.id === "enriched")!}
                  sortState={sortState}
                  onSort={handleSort}
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "source") && (
              <div className="w-[90px] text-center">
                <SortableHeader
                  column={columns.find(c => c.id === "source")!}
                  sortState={sortState}
                  onSort={handleSort}
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "lastCalled") && (
              <div className="w-[110px]">
                <SortableHeader 
                  column={columns.find(c => c.id === "lastCalled")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "callCount") && (
              <div className="w-[60px] text-center">
                <SortableHeader 
                  column={columns.find(c => c.id === "callCount")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "duration") && (
              <div className="w-[80px] text-center">
                <SortableHeader 
                  column={columns.find(c => c.id === "duration")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "voicemail") && (
              <div className="w-[50px] text-center">
                <SortableHeader 
                  column={columns.find(c => c.id === "voicemail")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "appointment") && (
              <div className="w-[120px]">
                <SortableHeader 
                  column={columns.find(c => c.id === "appointment")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            {visibleColumns.find(c => c.id === "summary") && (
              <div className="w-[150px]">Summary</div>
            )}
            {visibleColumns.find(c => c.id === "status") && (
              <div className="w-[100px] text-center">
                <SortableHeader 
                  column={columns.find(c => c.id === "status")!} 
                  sortState={sortState} 
                  onSort={handleSort} 
                />
              </div>
            )}
            <div className="w-10"></div> {/* Actions column */}
          </div>

          {/* Virtual List */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPractitioners.length === 0 ? (
            <NoPractitionersFound 
              onClearFilters={() => {
                setProvince("");
                setCity("");
                setPractitionerType("");
                setSearch("");
                setMinRating("");
                setHasEnrichment(false);
                setHasEmails(false);
                setHasTeamMembers(false);
                setIsMultilingual(false);
                setShowUserAddedOnly(false);
                setHideDNC(true);
                setShowDNCOnly(false);
              }}
            />
          ) : (
            <div ref={parentRef} className="flex-1 overflow-auto">
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const practitioner = filteredPractitioners[virtualRow.index];
                  const isSelected = selectedIds.has(practitioner.id);
                  const status = getCallStatus(practitioner.id);

                  return (
                    <div
                      key={practitioner.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      role="row"
                      tabIndex={0}
                      aria-selected={isSelected}
                      className={`flex items-center px-6 border-b cursor-pointer transition-colors data-table-row ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-950/30' 
                          : practitioner.do_not_call 
                            ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30' 
                            : 'hover:bg-muted/30'
                      }`}
                      onClick={() => handleRowClick(practitioner)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(practitioner);
                        }
                      }}
                    >
                      {visibleColumns.find(c => c.id === "select") && (
                        <div className="w-10" onClick={(e) => handleCheckboxClick(practitioner, virtualRow.index, e)}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${practitioner.name}`}
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded cursor-pointer"
                          />
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "name") && (
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <p className="practitioner-name truncate">{practitioner.name}</p>
                            {/* User Added badge */}
                            {practitioner.is_user_added && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400 shrink-0"
                              >
                                User Added
                              </Badge>
                            )}
                            {/* Do Not Call badge */}
                            {practitioner.do_not_call && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 h-4 bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-400 shrink-0"
                                title={practitioner.dnc_reason || "Do Not Call"}
                              >
                                DNC
                              </Badge>
                            )}
                            {/* Quick enrichment indicators (compact) */}
                            {practitioner.enrichment?.success && practitioner.enrichment?.data && (
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {practitioner.enrichment.data.practitioners?.length > 0 && (
                                  <span 
                                    className="w-3.5 h-3.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 text-[8px] font-semibold flex items-center justify-center"
                                    title={`${practitioner.enrichment.data.practitioners.length} team member(s)`}
                                  >
                                    {practitioner.enrichment.data.practitioners.length}
                                  </span>
                                )}
                                {practitioner.enrichment.data.emails?.length > 0 && (
                                  <span 
                                    className="w-3.5 h-3.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[8px] flex items-center justify-center"
                                    title={`${practitioner.enrichment.data.emails.length} email(s)`}
                                  >
                                    ✉
                                  </span>
                                )}
                                {practitioner.enrichment.data.languages?.length > 1 && (
                                  <span 
                                    className="w-3.5 h-3.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-[8px] flex items-center justify-center"
                                    title={`Multilingual: ${practitioner.enrichment.data.languages.join(', ')}`}
                                  >
                                    🌍
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="practitioner-address truncate">{practitioner.address}</p>
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "type") && (
                        <div className="w-[140px] text-muted-foreground truncate">
                          {practitioner.practitioner_type}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "city") && (
                        <div className="w-[120px]">{practitioner.city}</div>
                      )}
                      {visibleColumns.find(c => c.id === "province") && (
                        <div className="w-[100px] text-muted-foreground">{practitioner.province}</div>
                      )}
                      {visibleColumns.find(c => c.id === "rating") && (
                        <div className="w-[80px] text-center">
                          {practitioner.rating ? (
                            <span className="flex items-center justify-center gap-1">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              {practitioner.rating}
                            </span>
                          ) : '-'}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "reviews") && (
                        <div className="w-[80px] text-center text-muted-foreground">
                          {practitioner.review_count || 0}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "phone") && (
                        <div className="w-[120px] text-muted-foreground">
                          {practitioner.phone || '-'}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "enriched") && (
                        <div className="w-[90px] text-center">
                          {practitioner.enrichment?.success && practitioner.enrichment?.data ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 text-purple-700 dark:text-purple-300 text-[10px] font-medium"
                              title={`Enriched: ${practitioner.enrichment.data.practitioners?.length || 0} team members, ${practitioner.enrichment.data.emails?.length || 0} emails, ${practitioner.enrichment.data.services?.length || 0} services`}
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z"/>
                              </svg>
                              Yes
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "source") && (
                        <div className="w-[90px] text-center">
                          {practitioner.is_user_added ? (
                            <Badge 
                              variant="outline" 
                              className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400"
                            >
                              User Added
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Database</span>
                          )}
                        </div>
                      )}
                      {/* Call data columns */}
                      {visibleColumns.find(c => c.id === "lastCalled") && (
                        <div className="w-[110px] text-muted-foreground">
                          {getLastCallDate(practitioner.id) 
                            ? formatRelativeTime(getLastCallDate(practitioner.id)!)
                            : '-'}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "callCount") && (
                        <div className="w-[60px] text-center">
                          {getCallCount(practitioner.id) > 0 ? (
                            <Badge variant="secondary" className="text-[11px] px-1.5">
                              {getCallCount(practitioner.id)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "duration") && (
                        <div className="w-[80px] text-center text-muted-foreground">
                          {getCallDuration(practitioner.id) 
                            ? formatDuration(getCallDuration(practitioner.id)!)
                            : '-'}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "voicemail") && (
                        <div className="w-[50px] text-center">
                          {hasVoicemail(practitioner.id) && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] px-1">
                              VM
                            </Badge>
                          )}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "appointment") && (
                        <div className="w-[120px]">
                          {getAppointmentTime(practitioner.id) ? (
                            <span className="text-green-700 dark:text-green-400 font-medium">
                              {formatAppointment(getAppointmentTime(practitioner.id)!)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "summary") && (
                        <div className="w-[150px] text-muted-foreground truncate" title={getCallSummary(practitioner.id) || ''}>
                          {getCallSummary(practitioner.id) 
                            ? getCallSummary(practitioner.id)!.substring(0, 30) + (getCallSummary(practitioner.id)!.length > 30 ? '...' : '')
                            : '-'}
                        </div>
                      )}
                      {visibleColumns.find(c => c.id === "status") && (
                        <div className="w-[100px] text-center flex flex-col items-center gap-0.5">
                          <Badge className={`${STATUS_COLORS[status]} text-[11px]`}>
                            {STATUS_LABELS[status]}
                          </Badge>
                          {/* Sentiment and Lead Score indicators */}
                          {(getSentimentLabel(practitioner.id) || getLeadScore(practitioner.id) > 0) && (
                            <div className="flex items-center gap-1">
                              {getSentimentLabel(practitioner.id) && (
                                <span 
                                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                    getSentimentLabel(practitioner.id) === 'positive' 
                                      ? 'bg-green-100 text-green-600' 
                                      : getSentimentLabel(practitioner.id) === 'negative'
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}
                                  title={`Sentiment: ${getSentimentLabel(practitioner.id)}`}
                                >
                                  {getSentimentLabel(practitioner.id) === 'positive' && <Smile className="w-3 h-3" />}
                                  {getSentimentLabel(practitioner.id) === 'negative' && <Frown className="w-3 h-3" />}
                                  {getSentimentLabel(practitioner.id) === 'neutral' && <Meh className="w-3 h-3" />}
                                </span>
                              )}
                              {getLeadScore(practitioner.id) > 0 && (
                                <span 
                                  className={`text-[9px] font-bold px-1 rounded ${
                                    getLeadScore(practitioner.id) >= 70 
                                      ? 'bg-purple-100 text-purple-700' 
                                      : getLeadScore(practitioner.id) >= 40
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-700'
                                  }`}
                                  title={`Lead Score: ${getLeadScore(practitioner.id)}`}
                                >
                                  {getLeadScore(practitioner.id)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Row Actions */}
                      <div className="w-10">
                        <RowActionsMenu
                          onView={() => handleRowClick(practitioner)}
                          onCall={() => handleQuickCall(practitioner)}
                          onAddToQueue={() => {
                            if (!callRecords[practitioner.id]) {
                              createCallRecord({
                                id: practitioner.id,
                                name: practitioner.name,
                                practitioner_type: practitioner.practitioner_type,
                                phone: practitioner.phone || "",
                                address: practitioner.address,
                                city: practitioner.city,
                                province: practitioner.province,
                              });
                            }
                          }}
                          disabled={!practitioner.phone}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more trigger */}
              {pagination.hasMore && (
                <div className="p-4 text-center">
                  <Button 
                    variant="outline" 
                    onClick={loadMorePractitioners}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Load More ({filteredPractitioners.length}{filteredPractitioners.length !== practitioners.length ? ` filtered / ${practitioners.length} loaded` : ''} of {pagination.total})
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

          {/* Enrichment Progress Bar */}
          {isEnrichingBulk && (
            <div className="border-t px-6 py-3 bg-purple-50">
              <div className="flex items-center gap-4">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-purple-700">
                      Enriching: {enrichmentProgress.currentName}
                    </span>
                    <span className="text-sm text-purple-600">
                      {enrichmentProgress.current} / {enrichmentProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(enrichmentProgress.current / enrichmentProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selection Action Bar */}
          {selectedIds.size > 0 && !isEnrichingBulk && (
            <div className="border-t px-6 py-3 bg-blue-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-medium">
                  {selectedIds.size} practitioner{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {/* Bulk Enrich Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={bulkEnrichSelected}
                  disabled={isEnrichingBulk}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Enrich Selected
                </Button>
                
                {campaignRunning ? (
                  <>
                    {campaignPaused ? (
                      <Button onClick={resumeCampaign} size="sm">
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    ) : (
                      <Button onClick={pauseCampaign} variant="outline" size="sm">
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                    )}
                    <Button onClick={stopCampaign} variant="destructive" size="sm">
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  </>
                ) : (
                  <Button onClick={startCampaign} size="sm">
                    <PhoneCall className="w-4 h-4 mr-2" />
                    Start Calling ({selectedIds.size})
                  </Button>
                )}
              </div>
            </div>
          )}
        </ErrorBoundary>
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="flex-1 m-0 overflow-hidden">
        <ErrorBoundary section="Pipeline">
          {Object.keys(callRecords).length === 0 ? (
            <NoPipelineData 
              onAddToQueue={() => setActiveTab("practitioners")}
            />
          ) : (
            <PipelineBoard
              records={callRecords}
              onCardClick={async (record) => {
                // Find the practitioner data and open detail drawer
                let practitioner = practitioners.find(p => p.id === record.practitioner_id);
                
                // If not in current list, try to fetch from API or create from record data
                if (!practitioner && record.practitioner_id) {
                  try {
                    const response = await fetch(`/api/practitioners?id=${record.practitioner_id}`);
                    const data = await response.json();
                    if (data.practitioners?.length > 0) {
                      practitioner = data.practitioners[0];
                    }
                  } catch (err) {
                    console.warn('Failed to fetch practitioner:', err);
                  }
                }
                
                // Fallback: create minimal practitioner from call record
                if (!practitioner && record.practitioner_id) {
                  practitioner = {
                    id: record.practitioner_id,
                    name: record.practitioner_name || 'Unknown',
                    practitioner_type: record.practitioner_type || 'Unknown',
                    address: record.address || '',
                    city: record.city || '',
                    province: record.province || '',
                    phone: record.phone || null,
                    country: 'Canada',
                    // Required PractitionerData fields with default values
                    website: null,
                    rating: null,
                    review_count: null,
                    business_status: 'OPERATIONAL',
                    google_maps_uri: '',
                    latitude: 0,
                    longitude: 0,
                    scraped_at: new Date().toISOString(),
                    notes: '',
                    is_user_added: true,
                  } as PractitionerData;
                }
                
                if (practitioner) {
                  setSelectedPractitioner(practitioner);
                  setDetailDrawerOpen(true);
                }
              }}
            />
          )}
        </ErrorBoundary>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="flex-1 m-0 overflow-hidden">
        <ErrorBoundary section="Analytics">
          {Object.keys(callRecords).length === 0 ? (
            <NoAnalyticsData 
              onMakeCalls={() => setActiveTab("practitioners")}
            />
          ) : (
            <AnalyticsDashboard records={callRecords} stats={stats} />
          )}
        </ErrorBoundary>
        </TabsContent>

        {/* Quick Call Tab */}
        <TabsContent value="quick-call" className="flex-1 m-0 p-6 overflow-auto">
          <QuickCallTab
            onCallStarted={async (practitioner, callId) => {
              const record = createCallRecord({
                id: practitioner.id,
                name: practitioner.name,
                practitioner_type: practitioner.practitioner_type,
                phone: practitioner.phone,
                address: practitioner.address,
                city: practitioner.city,
                province: practitioner.province,
                call_id: callId,
              });
              // Await Supabase sync so the record is visible in live queue & analytics
              await syncCallRecordToSupabase(record);
              loadCallRecords();
              scheduleCallRecordRefreshes();
            }}
            onManualCallStarted={async (practitioner, callId) => {
              const record = createCallRecord({
                id: practitioner.id,
                name: practitioner.name,
                practitioner_type: practitioner.practitioner_type,
                phone: practitioner.phone,
                address: practitioner.address,
                city: practitioner.city,
                province: practitioner.province,
                call_id: callId,
              });
              // Await Supabase sync so the record is visible in live queue & analytics
              await syncCallRecordToSupabase(record);
              loadCallRecords();
              loadPractitioners(1);
              scheduleCallRecordRefreshes();
            }}
            onViewPractitioner={(p) => {
              // QuickCallTab's PractitionerData is a subset - cast via unknown
              setSelectedPractitioner(p as unknown as PractitionerData);
              setDetailDrawerOpen(true);
            }}
            onCallSuccess={(name) => callNotifications.started(name)}
            onCallFailed={(name, msg) => callNotifications.failed(name, msg)}
          />
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="flex-1 m-0 overflow-hidden flex flex-col">
          {/* Load All Banner */}
          {!allPractitionersLoaded && pagination.hasMore && (
            <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                <MapPin className="w-4 h-4" />
                <span>
                  Showing <strong>{filteredPractitioners.length}</strong> of <strong>{pagination.total.toLocaleString()}</strong> practitioners. 
                  Load all to see the complete map.
                </span>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={loadAllPractitioners}
                disabled={loadingAllPractitioners}
                className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
              >
                {loadingAllPractitioners ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Load All ({pagination.total.toLocaleString()})
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Map Component */}
          <div className="flex-1">
            {filteredPractitioners.filter(p => p.latitude && p.longitude).length === 0 ? (
              <NoMapData 
                onLoadPractitioners={() => loadAllPractitioners()}
              />
            ) : (
              <PractitionerMap 
                practitioners={filteredPractitioners.map(p => ({
                  id: p.id,
                  name: p.name,
                  address: p.address,
                  city: p.city,
                  province: p.province,
                  phone: p.phone || undefined,
                  practitioner_type: p.practitioner_type,
                  latitude: p.latitude,
                  longitude: p.longitude,
                  rating: p.rating ? Number(p.rating) : undefined,
                  review_count: p.review_count ? Number(p.review_count) : undefined,
                }))}
                callRecords={callRecords}
                selectedCountry={country}
                selectedProvince={province}
                selectedCity={city}
                onPractitionerClick={(practitioner) => {
                  const full = practitioners.find(p => p.id === practitioner.id);
                  if (full) {
                    setSelectedPractitioner(full);
                    setDetailDrawerOpen(true);
                  }
                }}
              />
            )}
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="flex-1 m-0 overflow-hidden">
          {Object.keys(callRecords).length === 0 ? (
            <NoCallsYet
              onStartCampaign={() => setActiveTab("practitioners")}
            />
          ) : (
            <CallTimeline
              records={callRecords}
              onEventClick={(record) => {
                const practitioner = practitioners.find(p => p.id === record.practitioner_id);
                if (practitioner) {
                  setSelectedPractitioner(practitioner);
                  setDetailDrawerOpen(true);
                }
              }}
            />
          )}
        </TabsContent>

        {/* Retry Queue Tab */}
        <TabsContent value="retries" className="flex-1 flex flex-col overflow-hidden m-0 p-6">
          <div className="flex-1 flex flex-col overflow-hidden bg-background rounded-lg border">
            {/* Header */}
            <div className="border-b px-6 py-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold">Retry Queue</h2>
                  <Badge variant="outline">{retryStats.total} scheduled</Badge>
                  {retryQueueConnected && (
                    <Badge variant="secondary" className="gap-1">
                      <Radio className="w-3 h-3 text-green-500" />
                      Live
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => refreshRetryQueue()}>
                    <RefreshCw className={`w-4 h-4 ${retryQueueLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              
              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">{retryStats.dueNow}</div>
                    <div className="text-sm text-muted-foreground">Due Now</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-yellow-600">{retryStats.nextHour}</div>
                    <div className="text-sm text-muted-foreground">Next Hour</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{retryStats.next24Hours}</div>
                    <div className="text-sm text-muted-foreground">Next 24 Hours</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Queue List */}
            {retryQueueLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : retryQueue.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-12">
                  <RotateCcw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-1">No Pending Retries</h3>
                  <p className="text-muted-foreground">All calls are up to date</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {retryQueue.map((item) => {
                    const retryTime = item.next_retry_at ? new Date(item.next_retry_at) : null;
                    const now = new Date();
                    const isDue = retryTime && retryTime <= now;
                    const timeUntil = retryTime ? Math.max(0, retryTime.getTime() - now.getTime()) : 0;
                    const minutesUntil = Math.floor(timeUntil / 60000);
                    const hoursUntil = Math.floor(minutesUntil / 60);

                    return (
                      <div
                        key={item.id}
                        className={`px-6 py-4 hover:bg-muted/50 transition-colors ${isDue ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-2 h-2 rounded-full ${isDue ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`} />
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{item.phone}</span>
                                {item.city && <span className="text-muted-foreground/60">• {item.city}, {item.province}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {isDue ? (
                                  <span className="text-red-600">Due Now</span>
                                ) : hoursUntil > 0 ? (
                                  <span>In {hoursUntil}h {minutesUntil % 60}m</span>
                                ) : (
                                  <span>In {minutesUntil}m</span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Retry #{item.retry_count + 1}
                              </div>
                            </div>
                            {item.retry_reason && (
                              <Badge variant="outline" className="text-xs">
                                {item.retry_reason}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        {/* Search New Practitioners Tab */}
        <TabsContent value="search" className="flex-1 flex flex-col overflow-hidden m-0 p-6">
          <PractitionerSearchTab 
            onPractitionerImported={() => {
              // Refresh practitioners list after import
              loadPractitioners(1);
            }}
          />
        </TabsContent>
        </Tabs>
      </div>

      {/* Practitioner Detail Drawer */}
      <PractitionerDetailDrawer
        practitioner={selectedPractitioner}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        onCallStarted={handleCallStarted}
        onQueued={() => {
          loadCallRecords();
          setQueueDrawerOpen(true);
        }}
        onPractitionerUpdated={(updated) => {
          setPractitioners((prev) =>
            prev.map((p) =>
              p.id === updated.id ? ({ ...p, ...updated } as PractitionerData) : p
            )
          );
          setSelectedPractitioner((prev) =>
            prev && prev.id === updated.id
              ? ({ ...prev, ...updated } as PractitionerData)
              : prev
          );
        }}
        onPractitionerDeleted={(id) => {
          setPractitioners((prev) => prev.filter((p) => p.id !== id));
        }}
      />

      {/* Global Command Search */}
      <CommandSearch
        practitioners={practitioners}
        open={commandSearch.open}
        onOpenChange={commandSearch.setOpen}
        onSelect={(practitioner, action) => {
          if (action === "view") {
            setSelectedPractitioner(practitioner as PractitionerData);
            setDetailDrawerOpen(true);
          } else if (action === "call") {
            handleQuickCall(practitioner as PractitionerData);
          } else if (action === "queue") {
            if (!callRecords[practitioner.id]) {
              createCallRecord({
                id: practitioner.id,
                name: practitioner.name,
                practitioner_type: practitioner.practitioner_type,
                phone: practitioner.phone || "",
                address: practitioner.address,
                city: practitioner.city,
                province: practitioner.province,
              });
            }
          }
        }}
      />
    </div>
  );
}

// Wrapper component with Suspense for useSearchParams
export default function CampaignPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Call Center...</p>
        </div>
      </div>
    }>
      <CampaignPageContent />
    </Suspense>
  );
}
