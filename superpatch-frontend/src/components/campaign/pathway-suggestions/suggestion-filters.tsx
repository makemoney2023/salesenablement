"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  RotateCcw,
  Filter,
} from "lucide-react";
import type { 
  PathwaySuggestionStatus, 
  PathwaySuggestionType, 
  PathwaySuggestionSeverity 
} from "@/lib/db/types";

interface SuggestionFiltersProps {
  status: PathwaySuggestionStatus | "all";
  practitionerType: string;
  suggestionType: PathwaySuggestionType | "all";
  severity: PathwaySuggestionSeverity | "all";
  search: string;
  onStatusChange: (status: PathwaySuggestionStatus | "all") => void;
  onPractitionerTypeChange: (type: string) => void;
  onSuggestionTypeChange: (type: PathwaySuggestionType | "all") => void;
  onSeverityChange: (severity: PathwaySuggestionSeverity | "all") => void;
  onSearchChange: (search: string) => void;
  onClearFilters: () => void;
  statusCounts: {
    new: number;
    approved: number;
    implemented: number;
    dismissed: number;
    reviewed: number;
  };
  practitionerTypes: string[];
}

const suggestionTypeOptions: { value: PathwaySuggestionType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "node_prompt", label: "Node Prompts" },
  { value: "edge_label", label: "Edge Labels" },
  { value: "missing_edge", label: "Missing Edges" },
  { value: "missing_node", label: "Missing Nodes" },
  { value: "knowledge_base_gap", label: "Knowledge Gaps" },
];

const severityOptions: { value: PathwaySuggestionSeverity | "all"; label: string }[] = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function SuggestionFilters({
  status,
  practitionerType,
  suggestionType,
  severity,
  search,
  onStatusChange,
  onPractitionerTypeChange,
  onSuggestionTypeChange,
  onSeverityChange,
  onSearchChange,
  onClearFilters,
  statusCounts,
  practitionerTypes,
}: SuggestionFiltersProps) {
  const activeFilters = [
    practitionerType !== "all",
    suggestionType !== "all",
    severity !== "all",
    search.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <Tabs value={status} onValueChange={(v) => onStatusChange(v as PathwaySuggestionStatus | "all")}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="new" className="gap-1">
            New
            {statusCounts.new > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {statusCounts.new}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1">
            Approved
            {statusCounts.approved > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-green-100 text-green-800">
                {statusCounts.approved}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="implemented" className="gap-1">
            Deployed
            {statusCounts.implemented > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {statusCounts.implemented}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dismissed" className="gap-1">
            Dismissed
            {statusCounts.dismissed > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {statusCounts.dismissed}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suggestions..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {/* Practitioner type */}
        <Select
          value={practitionerType}
          onValueChange={onPractitionerTypeChange}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Practitioner Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Practitioners</SelectItem>
            {practitionerTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Suggestion type */}
        <Select
          value={suggestionType}
          onValueChange={(v) => onSuggestionTypeChange(v as PathwaySuggestionType | "all")}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Suggestion Type" />
          </SelectTrigger>
          <SelectContent>
            {suggestionTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Severity */}
        <Select
          value={severity}
          onValueChange={(v) => onSeverityChange(v as PathwaySuggestionSeverity | "all")}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            {severityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear ({activeFilters})
          </Button>
        )}
      </div>
    </div>
  );
}

export default SuggestionFilters;
