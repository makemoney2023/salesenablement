"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Package,
  Users,
  Clock,
  DollarSign,
  Mail,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Target,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LLMAnalysisData, AnalysisStatus } from "@/lib/db/types";
import { toast } from "sonner";
import { useState } from "react";

interface LLMAnalysisPanelProps {
  analysis: LLMAnalysisData | null;
  llmLeadScore: number | null;
  analysisStatus: AnalysisStatus | null;
  analyzedAt: string | null;
  ruleBasedScore?: number;
}

const statusConfig: Record<AnalysisStatus, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  pending: { icon: Clock, label: "Pending", color: "text-yellow-500" },
  processing: { icon: Loader2, label: "Analyzing...", color: "text-blue-500" },
  completed: { icon: CheckCircle2, label: "Complete", color: "text-green-500" },
  failed: { icon: XCircle, label: "Failed", color: "text-red-500" },
};

export function LLMAnalysisPanel({
  analysis,
  llmLeadScore,
  analysisStatus,
  analyzedAt,
  ruleBasedScore,
}: LLMAnalysisPanelProps) {
  const [showFollowUp, setShowFollowUp] = useState(false);

  const status = analysisStatus || "pending";
  const StatusIcon = statusConfig[status]?.icon || Clock;
  const statusLabel = statusConfig[status]?.label || "Unknown";
  const statusColor = statusConfig[status]?.color || "text-gray-500";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // If no analysis yet
  if (!analysis && status !== "completed") {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <div className={cn("flex items-center justify-center gap-2 mb-2", statusColor)}>
            <StatusIcon className={cn("w-5 h-5", status === "processing" && "animate-spin")} />
            <span className="font-medium">{statusLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {status === "pending" && "LLM analysis will run after the call completes."}
            {status === "processing" && "AI is analyzing the call transcript..."}
            {status === "failed" && "Analysis failed. Will retry on next call."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-4">
      {/* Analysis Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <span className="font-medium text-sm">AI Analysis</span>
          <Badge variant="secondary" className={cn("text-xs", statusColor)}>
            <StatusIcon className={cn("w-3 h-3 mr-1", status === "processing" && "animate-spin")} />
            {statusLabel}
          </Badge>
        </div>
        {analyzedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(analyzedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Lead Score Comparison */}
      {llmLeadScore !== null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              Lead Score Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">AI Score</span>
                  <span className="font-bold text-lg">{llmLeadScore}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      llmLeadScore >= 70 ? "bg-green-500" :
                      llmLeadScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${llmLeadScore}%` }}
                  />
                </div>
              </div>
              {ruleBasedScore !== undefined && ruleBasedScore > 0 && (
                <div className="text-center px-3 border-l">
                  <span className="text-xs text-muted-foreground block">Rule-based</span>
                  <span className="text-sm font-medium">{ruleBasedScore}</span>
                </div>
              )}
            </div>
            {analysis.lead_score_reasoning && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                {analysis.lead_score_reasoning}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Key Insights Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Buying Signals */}
        {analysis.buying_signals && analysis.buying_signals.length > 0 && (
          <Card className="col-span-2 sm:col-span-1 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <TrendingUp className="w-3.5 h-3.5" />
                Buying Signals ({analysis.buying_signals.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-1">
                {analysis.buying_signals.map((signal, i) => (
                  <li key={i} className="text-xs text-green-800 dark:text-green-300 flex items-start gap-1">
                    <span className="text-green-500 mt-0.5">•</span>
                    {signal}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Objections */}
        {analysis.objections_raised && analysis.objections_raised.length > 0 && (
          <Card className="col-span-2 sm:col-span-1 border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                Objections ({analysis.objections_raised.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-1">
                {analysis.objections_raised.map((objection, i) => (
                  <li key={i} className="text-xs text-orange-800 dark:text-orange-300 flex items-start gap-1">
                    <span className="text-orange-500 mt-0.5">•</span>
                    {objection}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Pain Points */}
        {analysis.pain_points && analysis.pain_points.length > 0 && (
          <Card className="col-span-2 sm:col-span-1 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                <MessageSquare className="w-3.5 h-3.5" />
                Pain Points ({analysis.pain_points.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-1">
                {analysis.pain_points.map((point, i) => (
                  <li key={i} className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-1">
                    <span className="text-blue-500 mt-0.5">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Products Discussed */}
        {analysis.products_discussed && analysis.products_discussed.length > 0 && (
          <Card className="col-span-2 sm:col-span-1 border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                <Package className="w-3.5 h-3.5" />
                Products Discussed
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                {analysis.products_discussed.map((product, i) => (
                  <Badge key={i} variant="secondary" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                    {product}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Additional Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Additional Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Decision Maker */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Decision Maker Spoke
            </span>
            <Badge variant={analysis.decision_maker_spoke ? "default" : "secondary"}>
              {analysis.decision_maker_spoke ? "Yes" : "No / Unknown"}
            </Badge>
          </div>

          {/* Budget Discussed */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Budget Discussed
            </span>
            <Badge variant={analysis.budget_discussed ? "default" : "secondary"}>
              {analysis.budget_discussed ? "Yes" : "No"}
            </Badge>
          </div>

          {/* Timeline */}
          {analysis.timeline_mentioned && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Timeline Mentioned
              </span>
              <span className="text-xs">{analysis.timeline_mentioned}</span>
            </div>
          )}

          {/* Next Steps */}
          {analysis.next_steps_agreed && (
            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground block mb-1">Next Steps Agreed:</span>
              <p className="text-sm">{analysis.next_steps_agreed}</p>
            </div>
          )}

          {/* Extracted Contact Info */}
          {(analysis.contact_name_extracted || analysis.email_extracted) && (
            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground block mb-1">Extracted Contact:</span>
              <div className="space-y-1">
                {analysis.contact_name_extracted && (
                  <p className="text-sm">
                    <span className="font-medium">{analysis.contact_name_extracted}</span>
                    {analysis.contact_role_extracted && (
                      <span className="text-muted-foreground"> ({analysis.contact_role_extracted})</span>
                    )}
                  </p>
                )}
                {analysis.email_extracted && (
                  <p className="text-sm flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {analysis.email_extracted}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Competitor Mentions */}
          {analysis.competitor_mentions && analysis.competitor_mentions.length > 0 && (
            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground block mb-1">Competitors Mentioned:</span>
              <div className="flex flex-wrap gap-1">
                {analysis.competitor_mentions.map((competitor, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {competitor}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-Up Email (if generated) */}
      {analysis.follow_up && analysis.follow_up.content && (
        <Collapsible open={showFollowUp} onOpenChange={setShowFollowUp}>
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    AI-Generated Follow-Up Email
                  </CardTitle>
                  {showFollowUp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {analysis.follow_up.subject && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <p className="text-sm font-medium">{analysis.follow_up.subject}</p>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">Email Body</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(analysis.follow_up?.content || "", "Email")}
                      className="h-6 px-2 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px] rounded-md border p-3">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {analysis.follow_up.content}
                    </pre>
                  </ScrollArea>
                </div>
                {analysis.follow_up.context_data && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {analysis.follow_up.context_data.studies_to_reference && (
                      <p>Studies to reference: {analysis.follow_up.context_data.studies_to_reference.join(", ")}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}

// Simple Label component for follow-up section
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-sm font-medium", className)}>{children}</span>;
}

export default LLMAnalysisPanel;
