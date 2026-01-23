"use client";

import { useState } from "react";
import { useFollowUpQueue, type FollowUpStatus, type FollowUpItem } from "@/hooks/useFollowUpQueue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  MessageSquare,
  FileText,
  Clock,
  CheckCircle2,
  Send,
  XCircle,
  Search,
  RefreshCw,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Wifi,
  WifiOff,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<FollowUpStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  draft: { label: "Draft", icon: Clock, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  approved: { label: "Approved", icon: CheckCircle2, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  sent: { label: "Sent", icon: Send, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  failed: { label: "Failed", icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

const TYPE_CONFIG = {
  email: { label: "Email", icon: Mail },
  sms: { label: "SMS", icon: MessageSquare },
  callback_notes: { label: "Callback Notes", icon: FileText },
};

export default function FollowUpQueuePage() {
  const [activeStatus, setActiveStatus] = useState<FollowUpStatus | "all">("draft");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<FollowUpItem | null>(null);

  const {
    items,
    loading,
    error,
    isConnected,
    refresh,
    updateStatus,
    deleteItem,
    statusCounts,
  } = useFollowUpQueue({
    statusFilter: activeStatus,
  });

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.subject?.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query) ||
      item.practitioner_name?.toLowerCase().includes(query)
    );
  });

  const handleApprove = async (item: FollowUpItem) => {
    const success = await updateStatus(item.id, "approved");
    if (success) {
      toast.success("Follow-up approved");
    } else {
      toast.error("Failed to approve follow-up");
    }
  };

  const handleDismiss = async (item: FollowUpItem) => {
    const success = await deleteItem(item.id);
    if (success) {
      toast.success("Follow-up deleted");
    } else {
      toast.error("Failed to delete follow-up");
    }
  };

  const handleMarkSent = async (item: FollowUpItem) => {
    const success = await updateStatus(item.id, "sent");
    if (success) {
      toast.success("Marked as sent");
    } else {
      toast.error("Failed to update status");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const totalQueue = statusCounts.draft + statusCounts.approved;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Mail className="w-6 h-6 text-purple-500" />
              Follow-Up Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated follow-up emails and messages waiting for review
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <Badge variant="outline" className={cn(
              "text-xs",
              isConnected ? "text-green-600" : "text-red-600"
            )}>
              {isConnected ? (
                <><Wifi className="w-3 h-3 mr-1" />Live</>
              ) : (
                <><WifiOff className="w-3 h-3 mr-1" />Offline</>
              )}
            </Badge>

            {/* Refresh Button */}
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
              <Clock className="w-3 h-3 mr-1" />
              {statusCounts.draft} drafts
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {statusCounts.approved} approved
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              <Send className="w-3 h-3 mr-1" />
              {statusCounts.sent} sent
            </Badge>
          </div>
          {totalQueue > 0 && (
            <div className="text-sm text-muted-foreground">
              {totalQueue} item{totalQueue !== 1 ? 's' : ''} in queue
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b px-6 py-3 bg-muted/30">
        <div className="flex items-center gap-4">
          {/* Status Tabs */}
          <Tabs value={activeStatus} onValueChange={(v) => setActiveStatus(v as FollowUpStatus | "all")}>
            <TabsList>
              <TabsTrigger value="draft" className="gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Drafts
                {statusCounts.draft > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{statusCounts.draft}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved
                {statusCounts.approved > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{statusCounts.approved}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Sent
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5">
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by content or practitioner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="m-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Mail className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">No follow-ups found</h3>
            <p className="text-sm text-muted-foreground">
              {activeStatus === "draft"
                ? "New AI-generated follow-ups will appear here after calls are analyzed."
                : `No ${activeStatus} items to show.`}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              {filteredItems.map((item) => (
                <FollowUpCard
                  key={item.id}
                  item={item}
                  onApprove={() => handleApprove(item)}
                  onDismiss={() => handleDismiss(item)}
                  onMarkSent={() => handleMarkSent(item)}
                  onCopy={copyToClipboard}
                  onViewDetail={() => setSelectedItem(item)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedItem && (
        <FollowUpDetailDialog
          item={selectedItem}
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
          onApprove={() => {
            handleApprove(selectedItem);
            setSelectedItem(null);
          }}
          onDismiss={() => {
            handleDismiss(selectedItem);
            setSelectedItem(null);
          }}
          onMarkSent={() => {
            handleMarkSent(selectedItem);
            setSelectedItem(null);
          }}
          onCopy={copyToClipboard}
        />
      )}
    </div>
  );
}

// Follow-up card component
interface FollowUpCardProps {
  item: FollowUpItem;
  onApprove: () => void;
  onDismiss: () => void;
  onMarkSent: () => void;
  onCopy: (text: string, label: string) => void;
  onViewDetail: () => void;
}

function FollowUpCard({
  item,
  onApprove,
  onDismiss,
  onMarkSent,
  onCopy,
  onViewDetail,
}: FollowUpCardProps) {
  const statusConfig = STATUS_CONFIG[item.status];
  const typeConfig = TYPE_CONFIG[item.type];
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onViewDetail}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className={cn("shrink-0", statusConfig.color)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <Badge variant="secondary" className="shrink-0">
              <TypeIcon className="w-3 h-3 mr-1" />
              {typeConfig.label}
            </Badge>
            <Badge variant="outline" className="shrink-0 text-purple-600 border-purple-300">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Generated
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.status === "draft" && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onApprove(); }}>
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="text-red-600">
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Dismiss
                  </DropdownMenuItem>
                </>
              )}
              {item.status === "approved" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkSent(); }}>
                  <Send className="w-4 h-4 mr-2" />
                  Mark as Sent
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(item.content, "Content"); }}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Content
              </DropdownMenuItem>
              {item.subject && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(item.subject!, "Subject"); }}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Subject
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-2">
          {item.practitioner_name && (
            <p className="text-sm font-medium">{item.practitioner_name}</p>
          )}
          {item.subject && (
            <CardTitle className="text-base">{item.subject}</CardTitle>
          )}
          <CardDescription className="text-xs mt-1">
            Created {new Date(item.created_at).toLocaleString()}
            {item.sent_at && ` • Sent ${new Date(item.sent_at).toLocaleString()}`}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
          {item.content}
        </p>

        {/* Context tags */}
        {item.context_data && (
          <div className="flex flex-wrap gap-1 mt-3">
            {item.context_data.products_mentioned?.map((product, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {product}
              </Badge>
            ))}
            {item.context_data.objections_to_address?.map((objection, i) => (
              <Badge key={i} variant="outline" className="text-xs text-orange-600 border-orange-200">
                {objection}
              </Badge>
            ))}
          </div>
        )}

        {/* Action buttons for draft items */}
        {item.status === "draft" && (
          <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={onApprove}>
              <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
              Approve
            </Button>
            <Button variant="outline" size="sm" onClick={onDismiss}>
              <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
              Dismiss
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onCopy(item.content, "Content")}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy
            </Button>
          </div>
        )}

        {/* Action for approved items */}
        {item.status === "approved" && (
          <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={onMarkSent}>
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Mark as Sent
            </Button>
            <Button variant="outline" size="sm" onClick={() => onCopy(item.content, "Content")}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy
            </Button>
            {item.practitioner_email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${item.practitioner_email}?subject=${encodeURIComponent(item.subject || "Follow-up")}&body=${encodeURIComponent(item.content)}`}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open in Email
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Detail Dialog
interface FollowUpDetailDialogProps {
  item: FollowUpItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onDismiss: () => void;
  onMarkSent: () => void;
  onCopy: (text: string, label: string) => void;
}

function FollowUpDetailDialog({
  item,
  open,
  onOpenChange,
  onApprove,
  onDismiss,
  onMarkSent,
  onCopy,
}: FollowUpDetailDialogProps) {
  const statusConfig = STATUS_CONFIG[item.status];
  const typeConfig = TYPE_CONFIG[item.type];
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={cn(statusConfig.color)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <Badge variant="secondary">
              <TypeIcon className="w-3 h-3 mr-1" />
              {typeConfig.label}
            </Badge>
          </div>
          <DialogTitle>{item.subject || "Follow-up Content"}</DialogTitle>
          <DialogDescription>
            {item.practitioner_name && (
              <span className="font-medium">{item.practitioner_name}</span>
            )}
            {item.practitioner_email && (
              <span className="text-muted-foreground"> ({item.practitioner_email})</span>
            )}
            <br />
            Created {new Date(item.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 my-4">
          <div className="space-y-4">
            {/* Email Content */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">Content</span>
                <Button variant="ghost" size="sm" onClick={() => onCopy(item.content, "Content")}>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="text-sm whitespace-pre-wrap font-sans">{item.content}</pre>
            </div>

            {/* Context Data */}
            {item.context_data && Object.keys(item.context_data).length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">AI Context</span>
                
                {item.context_data.products_mentioned && item.context_data.products_mentioned.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Products mentioned:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.context_data.products_mentioned.map((product, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{product}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {item.context_data.objections_to_address && item.context_data.objections_to_address.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Objections to address:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.context_data.objections_to_address.map((objection, i) => (
                        <Badge key={i} variant="outline" className="text-xs text-orange-600 border-orange-200">
                          {objection}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {item.context_data.studies_to_reference && item.context_data.studies_to_reference.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Studies to reference:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.context_data.studies_to_reference.map((study, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{study}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          {item.status === "draft" && (
            <>
              <Button variant="outline" onClick={onDismiss}>
                <ThumbsDown className="w-4 h-4 mr-2" />
                Dismiss
              </Button>
              <Button onClick={onApprove}>
                <ThumbsUp className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          {item.status === "approved" && (
            <>
              <Button variant="outline" onClick={() => onCopy(item.content, "Content")}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              {item.practitioner_email && (
                <Button variant="outline" asChild>
                  <a href={`mailto:${item.practitioner_email}?subject=${encodeURIComponent(item.subject || "Follow-up")}&body=${encodeURIComponent(item.content)}`}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Email
                  </a>
                </Button>
              )}
              <Button onClick={onMarkSent}>
                <Send className="w-4 h-4 mr-2" />
                Mark as Sent
              </Button>
            </>
          )}
          {item.status === "sent" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
