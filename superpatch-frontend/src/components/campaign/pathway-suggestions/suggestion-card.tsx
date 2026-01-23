"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  MessageSquare,
  GitBranch,
  Lightbulb,
  AlertTriangle,
  Zap,
  Database,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PathwaySuggestion, PathwaySuggestionStatus } from "@/lib/db/types";
import { toast } from "sonner";

interface SuggestionCardProps {
  suggestion: PathwaySuggestion;
  onApprove: (id: string) => Promise<boolean>;
  onDismiss: (id: string) => Promise<boolean>;
  showPractitionerType?: boolean;
}

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
  high: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
  low: { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-300" },
};

const suggestionTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  node_prompt: MessageSquare,
  edge_label: GitBranch,
  missing_edge: GitBranch,
  missing_node: Zap,
  knowledge_base_gap: Database,
};

const suggestionTypeLabels: Record<string, string> = {
  node_prompt: "Node Prompt",
  edge_label: "Edge Label",
  missing_edge: "Missing Edge",
  missing_node: "Missing Node",
  knowledge_base_gap: "Knowledge Gap",
};

const statusColors: Record<PathwaySuggestionStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  reviewed: "bg-purple-100 text-purple-800",
  implemented: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-gray-100 text-gray-500",
};

export function SuggestionCard({
  suggestion,
  onApprove,
  onDismiss,
  showPractitionerType = true,
}: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const severityStyle = severityColors[suggestion.severity] || severityColors.medium;
  const TypeIcon = suggestionTypeIcons[suggestion.suggestion_type] || Lightbulb;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const success = await onApprove(suggestion.id);
      if (success) {
        toast.success("Suggestion approved and queued for deployment");
      } else {
        toast.error("Failed to approve suggestion");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    try {
      const success = await onDismiss(suggestion.id);
      if (success) {
        toast.success("Suggestion dismissed");
      } else {
        toast.error("Failed to dismiss suggestion");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const isActionable = suggestion.status === "new";

  return (
    <Card className={cn("transition-all", !isActionable && "opacity-70")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          {/* Left side: Type and badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <TypeIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {suggestionTypeLabels[suggestion.suggestion_type]}
              </span>
            </div>
            
            <Badge className={cn("text-xs", severityStyle.bg, severityStyle.text)}>
              {suggestion.severity}
            </Badge>
            
            {suggestion.frequency_count > 1 && (
              <Badge variant="secondary" className="text-xs">
                seen {suggestion.frequency_count}x
              </Badge>
            )}
            
            {showPractitionerType && (
              <Badge variant="outline" className="text-xs">
                {suggestion.practitioner_type}
              </Badge>
            )}
            
            <Badge className={cn("text-xs", statusColors[suggestion.status])}>
              {suggestion.status}
            </Badge>
          </div>

          {/* Right side: Actions */}
          {isActionable && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                disabled={loading}
                className="h-8 px-2 text-muted-foreground hover:text-red-600"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={loading}
                className="h-8 px-3"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                Approve
              </Button>
            </div>
          )}
        </div>

        {/* Node/edge identifier */}
        {(suggestion.node_name || suggestion.node_id) && (
          <p className="text-xs text-muted-foreground mt-1">
            Node: <span className="font-mono">{suggestion.node_name || suggestion.node_id}</span>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Suggested content */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Suggested Change</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(suggestion.suggested_content, "Suggestion")}
              className="h-6 px-2 text-xs"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
          <div className="p-3 rounded-md bg-green-50 border border-green-200 text-sm whitespace-pre-wrap">
            {suggestion.suggested_content}
          </div>
        </div>

        {/* Current content (if available) */}
        {suggestion.current_content && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs w-full justify-between">
                <span>Current Content</span>
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm whitespace-pre-wrap mt-1">
                {suggestion.current_content}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Reasoning */}
        {suggestion.reasoning && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Why this suggestion
            </span>
            <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
          </div>
        )}

        {/* Transcript excerpt */}
        {suggestion.transcript_excerpt && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />
                View Transcript Excerpt
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 rounded-md bg-muted text-sm whitespace-pre-wrap mt-1 italic">
                &ldquo;{suggestion.transcript_excerpt}&rdquo;
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Metadata footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>
            Created {new Date(suggestion.created_at).toLocaleDateString()}
          </span>
          {suggestion.similar_call_ids && suggestion.similar_call_ids.length > 0 && (
            <span>
              {suggestion.similar_call_ids.length} similar call{suggestion.similar_call_ids.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SuggestionCard;
