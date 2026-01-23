"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Download,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  GitBranch,
  Database,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PathwaySuggestion } from "@/lib/db/types";
import { toast } from "sonner";

interface PendingChangesPanelProps {
  pendingByPractitioner: {
    [practitionerType: string]: {
      count: number;
      suggestions: PathwaySuggestion[];
    };
  };
  onExport: (practitionerType: string) => Promise<void>;
  onMarkDeployed: (practitionerType: string) => Promise<boolean>;
}

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

export function PendingChangesPanel({
  pendingByPractitioner,
  onExport,
  onMarkDeployed,
}: PendingChangesPanelProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [loadingExport, setLoadingExport] = useState<string | null>(null);
  const [loadingDeploy, setLoadingDeploy] = useState<string | null>(null);

  const practitionerTypes = Object.keys(pendingByPractitioner);
  const totalPending = practitionerTypes.reduce(
    (sum, type) => sum + pendingByPractitioner[type].count,
    0
  );

  const toggleExpanded = (type: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  const handleExport = async (type: string) => {
    setLoadingExport(type);
    try {
      await onExport(type);
      toast.success(`Exported ${type} pathway JSON`, {
        description: "Save to bland_ai_pathways folder and run deploy script",
      });
    } catch (error) {
      toast.error("Failed to export pathway");
    } finally {
      setLoadingExport(null);
    }
  };

  const handleMarkDeployed = async (type: string) => {
    setLoadingDeploy(type);
    try {
      const success = await onMarkDeployed(type);
      if (success) {
        toast.success(`Marked ${type} changes as deployed`);
      } else {
        toast.error("Failed to mark as deployed");
      }
    } finally {
      setLoadingDeploy(null);
    }
  };

  if (totalPending === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Pending Changes</CardTitle>
          <CardDescription>No approved changes waiting for deployment</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Pending Changes</CardTitle>
            <CardDescription>
              {totalPending} approved change{totalPending !== 1 ? "s" : ""} ready for deployment
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm">
            {totalPending} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {practitionerTypes.map((type) => {
          const { count, suggestions } = pendingByPractitioner[type];
          const isExpanded = expandedTypes.has(type);

          return (
            <div key={type} className="border rounded-lg">
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(type)}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{type}</span>
                      <Badge variant="outline" className="text-xs">
                        {count} change{count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport(type)}
                        disabled={loadingExport === type}
                        className="h-7 text-xs"
                      >
                        {loadingExport === type ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Download className="w-3 h-3 mr-1" />
                        )}
                        Export JSON
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMarkDeployed(type)}
                        disabled={loadingDeploy === type}
                        className="h-7 text-xs"
                      >
                        {loadingDeploy === type ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Check className="w-3 h-3 mr-1" />
                        )}
                        Mark Deployed
                      </Button>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2">
                    {suggestions.map((suggestion) => {
                      const Icon = suggestionTypeIcons[suggestion.suggestion_type] || MessageSquare;
                      return (
                        <div
                          key={suggestion.id}
                          className="flex items-start gap-2 p-2 rounded bg-muted/50 text-sm"
                        >
                          <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {suggestionTypeLabels[suggestion.suggestion_type]}
                              </span>
                              {suggestion.node_name && (
                                <span className="text-xs font-mono text-muted-foreground">
                                  @ {suggestion.node_name}
                                </span>
                              )}
                            </div>
                            <p className="text-sm truncate">{suggestion.suggested_content.slice(0, 100)}...</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}

        {/* Deployment instructions */}
        <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Deployment Steps:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Click &ldquo;Export JSON&rdquo; to download the updated pathway</li>
            <li>Save to <code className="bg-muted px-1 rounded">b2b_sales_enablement/bland_ai_pathways/</code></li>
            <li>Run <code className="bg-muted px-1 rounded">python update_pathways.py</code></li>
            <li>Click &ldquo;Mark Deployed&rdquo; to confirm</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

export default PendingChangesPanel;
