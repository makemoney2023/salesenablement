"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RotateCcw,
  Clock,
  Phone,
  MapPin,
  User,
  Loader2,
  RefreshCw,
  X,
  Play,
  AlertCircle,
  Calendar,
  Voicemail,
  PhoneOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import type { RetryQueueEntry, RetryReason } from "@/lib/db/types";

// Format time until retry
function formatTimeUntil(targetDate: string): string {
  const now = Date.now();
  const target = new Date(targetDate).getTime();
  const diff = target - now;

  if (diff <= 0) return "Due now";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Countdown timer component
function RetryCountdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState(formatTimeUntil(targetDate));
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      setIsPast(target <= now);
      setTimeLeft(formatTimeUntil(targetDate));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <span
      className={cn(
        "font-mono text-sm",
        isPast ? "text-orange-500" : "text-muted-foreground"
      )}
    >
      {timeLeft}
    </span>
  );
}

// Retry reason badge
function RetryReasonBadge({ reason }: { reason: RetryReason | null }) {
  if (!reason) return null;

  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    voicemail_left: {
      label: "Voicemail",
      variant: "secondary",
      icon: <Voicemail className="h-3 w-3" />,
    },
    no_answer: {
      label: "No Answer",
      variant: "outline",
      icon: <PhoneOff className="h-3 w-3" />,
    },
    call_failed: {
      label: "Failed",
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3" />,
    },
    busy: {
      label: "Busy",
      variant: "outline",
      icon: <Phone className="h-3 w-3" />,
    },
    manual_retry: {
      label: "Manual",
      variant: "default",
      icon: <RotateCcw className="h-3 w-3" />,
    },
  };

  const { label, variant, icon } = config[reason] || {
    label: reason,
    variant: "outline" as const,
    icon: null,
  };

  return (
    <Badge variant={variant} className="text-xs gap-1">
      {icon}
      {label}
    </Badge>
  );
}

// Single retry queue entry card
function RetryQueueCard({
  entry,
  onRetryNow,
  onCancel,
  isProcessing,
}: {
  entry: RetryQueueEntry;
  onRetryNow: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{entry.name}</span>
            <RetryReasonBadge reason={entry.retry_reason as RetryReason} />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <User className="h-3 w-3" />
            <span>{entry.practitioner_type || "Unknown"}</span>
            <span className="text-muted-foreground/50">•</span>
            <span>Attempt {entry.retry_count}/3</span>
          </div>

          {(entry.city || entry.province) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{[entry.city, entry.province].filter(Boolean).join(", ")}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <RetryCountdown targetDate={entry.next_retry_at} />
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={onRetryNow}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Retry Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={onCancel}
              disabled={isProcessing}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component
interface RetryQueuePanelProps {
  className?: string;
}

export function RetryQueuePanel({ className }: RetryQueuePanelProps) {
  const supabase = getBrowserSupabase();
  const [entries, setEntries] = useState<RetryQueueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancelDialogEntry, setCancelDialogEntry] = useState<RetryQueueEntry | null>(null);

  // Fetch upcoming retries
  const fetchRetries = useCallback(async () => {
    if (!isBrowserSupabaseConfigured || !supabase) {
      setError("Supabase not configured");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from("practitioners")
        .select("id, name, phone, practitioner_type, retry_count, next_retry_at, retry_reason, city, province")
        .not("next_retry_at", "is", null)
        .eq("do_not_call", false)
        .not("phone", "is", null)
        .order("next_retry_at", { ascending: true })
        .limit(50);

      if (fetchError) {
        console.error("[RetryQueue] Error fetching retries:", fetchError);
        setError(fetchError.message);
        return;
      }

      setEntries((data as RetryQueueEntry[]) || []);
    } catch (err) {
      console.error("[RetryQueue] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch retries");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Initial fetch
  useEffect(() => {
    fetchRetries();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchRetries, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRetries]);

  // Retry now handler
  const handleRetryNow = async (entry: RetryQueueEntry) => {
    setProcessingId(entry.id);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase not configured");
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/process-retry-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ practitionerIds: [entry.id] }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to initiate retry");
      }

      const result = await response.json();
      console.log("[RetryQueue] Retry initiated:", result);

      // Refresh the list
      await fetchRetries();
    } catch (err) {
      console.error("[RetryQueue] Error initiating retry:", err);
      toast.error(`Failed to initiate retry: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Cancel retry handler
  const handleCancelRetry = async () => {
    if (!cancelDialogEntry || !supabase) return;

    setProcessingId(cancelDialogEntry.id);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("practitioners")
        .update({
          next_retry_at: null,
          retry_reason: null,
        })
        .eq("id", cancelDialogEntry.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`[RetryQueue] Retry cancelled for ${cancelDialogEntry.name}`);

      // Remove from local state
      setEntries((prev) => prev.filter((e) => e.id !== cancelDialogEntry.id));
    } catch (err) {
      console.error("[RetryQueue] Error cancelling retry:", err);
      toast.error(`Failed to cancel retry: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setProcessingId(null);
      setCancelDialogEntry(null);
    }
  };

  // Filter entries by reason
  const filteredEntries = entries.filter((entry) => {
    if (filterReason === "all") return true;
    return entry.retry_reason === filterReason;
  });

  // Count by reason
  const countByReason = {
    all: entries.length,
    voicemail_left: entries.filter((e) => e.retry_reason === "voicemail_left").length,
    call_failed: entries.filter((e) => e.retry_reason === "call_failed").length,
    no_answer: entries.filter((e) => e.retry_reason === "no_answer").length,
  };

  // Count due now (past their retry time)
  const dueNow = entries.filter((e) => new Date(e.next_retry_at).getTime() <= Date.now()).length;

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-500" />
              Retry Queue
              <Badge variant="secondary" className="ml-1">
                {entries.length}
              </Badge>
              {dueNow > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {dueNow} due
                </Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              <Select value={filterReason} onValueChange={setFilterReason}>
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue placeholder="Filter by reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({countByReason.all})</SelectItem>
                  <SelectItem value="voicemail_left">Voicemail ({countByReason.voicemail_left})</SelectItem>
                  <SelectItem value="call_failed">Failed ({countByReason.call_failed})</SelectItem>
                  <SelectItem value="no_answer">No Answer ({countByReason.no_answer})</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={fetchRetries}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive mb-3">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No retries scheduled</p>
              <p className="text-xs">
                {filterReason !== "all"
                  ? "Try changing the filter"
                  : "Retries will appear here when calls need follow-up"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-2">
              <div className="space-y-2">
                {filteredEntries.map((entry) => (
                  <RetryQueueCard
                    key={entry.id}
                    entry={entry}
                    onRetryNow={() => handleRetryNow(entry)}
                    onCancel={() => setCancelDialogEntry(entry)}
                    isProcessing={processingId === entry.id}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelDialogEntry} onOpenChange={() => setCancelDialogEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Retry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {cancelDialogEntry?.name} from the retry queue.
              They won&apos;t be called again unless manually added or another call is made.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Scheduled</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelRetry}>
              Cancel Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default RetryQueuePanel;
