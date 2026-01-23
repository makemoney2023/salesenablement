"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  Loader2,
  Lightbulb,
  ArrowLeft,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { usePathwaySuggestions } from "@/hooks/usePathwaySuggestions";
import { SuggestionCard, SuggestionFilters, PendingChangesPanel } from "@/components/campaign/pathway-suggestions";
import type { 
  PathwaySuggestionStatus, 
  PathwaySuggestionType, 
  PathwaySuggestionSeverity 
} from "@/lib/db/types";

// Known practitioner types from pathways
const PRACTITIONER_TYPES = [
  "Chiropractors",
  "Naturopaths",
  "Acupuncturists",
  "Massage_Therapists",
  "Functional_Medicine",
  "Integrative_Medicine",
];

export default function PathwaySuggestionsPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<PathwaySuggestionStatus | "all">("new");
  const [practitionerTypeFilter, setPractitionerTypeFilter] = useState<string>("all");
  const [suggestionTypeFilter, setSuggestionTypeFilter] = useState<PathwaySuggestionType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<PathwaySuggestionSeverity | "all">("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Fetch suggestions with filters
  const {
    suggestions,
    loading,
    error,
    isConnected,
    refresh,
    updateStatus,
    markAllImplemented,
    statusCounts,
    pendingByPractitioner,
    pagination,
  } = usePathwaySuggestions({
    status: statusFilter,
    practitionerType: practitionerTypeFilter,
    suggestionType: suggestionTypeFilter,
    severity: severityFilter,
    search: searchFilter,
  });

  // Handlers
  const handleApprove = async (id: string) => {
    return await updateStatus(id, "approved");
  };

  const handleDismiss = async (id: string) => {
    return await updateStatus(id, "dismissed");
  };

  const handleExport = async (practitionerType: string) => {
    try {
      const response = await fetch("/api/pathway-suggestions/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ practitioner_type: practitionerType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Get the filename from the response header or use default
      const filename = `${practitionerType}_pathway_updated.json`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
      throw err;
    }
  };

  const handleMarkDeployed = async (practitionerType: string) => {
    return await markAllImplemented(practitionerType);
  };

  const clearFilters = () => {
    setPractitionerTypeFilter("all");
    setSuggestionTypeFilter("all");
    setSeverityFilter("all");
    setSearchFilter("");
  };

  // Summary stats
  const totalNew = statusCounts.new;
  const totalApproved = statusCounts.approved;
  const totalImplemented = statusCounts.implemented;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/campaign">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Pathway Suggestions
                </h1>
                <p className="text-sm text-muted-foreground">
                  LLM-generated improvements for conversational pathways
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Connection status */}
              <div className="flex items-center gap-1.5 text-xs">
                {isConnected ? (
                  <>
                    <Radio className="w-3 h-3 text-green-500" />
                    <span className="text-green-600">Live</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Offline</span>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm">
                <strong>{totalNew}</strong> new suggestions
              </span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm">
                <strong>{totalApproved}</strong> approved
              </span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>{totalImplemented}</strong> deployed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Suggestions list */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="p-4 border-b">
            <SuggestionFilters
              status={statusFilter}
              practitionerType={practitionerTypeFilter}
              suggestionType={suggestionTypeFilter}
              severity={severityFilter}
              search={searchFilter}
              onStatusChange={setStatusFilter}
              onPractitionerTypeChange={setPractitionerTypeFilter}
              onSuggestionTypeChange={setSuggestionTypeFilter}
              onSeverityChange={setSeverityFilter}
              onSearchChange={setSearchFilter}
              onClearFilters={clearFilters}
              statusCounts={statusCounts}
              practitionerTypes={PRACTITIONER_TYPES}
            />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => refresh()} className="mt-4">
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              ) : suggestions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Lightbulb className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {statusFilter === "new"
                        ? "No new suggestions. Run more calls to generate pathway improvements."
                        : `No ${statusFilter} suggestions found.`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Showing {suggestions.length} of {pagination.total} suggestions
                  </p>
                  {suggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onApprove={handleApprove}
                      onDismiss={handleDismiss}
                      showPractitionerType={practitionerTypeFilter === "all"}
                    />
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Sidebar - Pending changes */}
        <div className="w-[400px] flex-shrink-0 bg-muted/30">
          <ScrollArea className="h-full">
            <div className="p-4">
              <PendingChangesPanel
                pendingByPractitioner={pendingByPractitioner}
                onExport={handleExport}
                onMarkDeployed={handleMarkDeployed}
              />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
