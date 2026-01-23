"use client";

import { useState, useMemo } from "react";
import { useSampleRequests } from "@/hooks/useSampleRequests";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Box,
  XCircle,
  Search,
  RefreshCw,
  Loader2,
  MoreHorizontal,
  Phone,
  Mail,
  MapPin,
  User,
  Download,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileText,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SampleRequest, SampleStatus } from "@/lib/db/types";

const STATUS_CONFIG: Record<SampleStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  approved: { label: "Approved", icon: CheckCircle2, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  shipped: { label: "Shipped", icon: Truck, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  delivered: { label: "Delivered", icon: Box, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

export default function SamplesPage() {
  const [activeStatus, setActiveStatus] = useState<SampleStatus | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedSample, setSelectedSample] = useState<SampleRequest | null>(null);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [bulkActionTarget, setBulkActionTarget] = useState<string[]>([]);

  const {
    samples,
    loading,
    error,
    isConnected,
    refresh,
    updateSample,
    updateMultiple,
    statusCounts,
    pagination,
    setPage,
  } = useSampleRequests({
    statusFilter: activeStatus,
    search: searchQuery,
  });

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Select all
  const selectAll = () => {
    if (selectedIds.size === samples.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(samples.map((s) => s.id)));
    }
  };

  // Handle status update
  const handleStatusUpdate = async (sample: SampleRequest, newStatus: SampleStatus) => {
    const success = await updateSample(sample.id, { status: newStatus });
    if (success) {
      toast.success(`Sample marked as ${newStatus}`);
    } else {
      toast.error("Failed to update sample");
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async (newStatus: SampleStatus) => {
    if (selectedIds.size === 0) return;
    
    const success = await updateMultiple(Array.from(selectedIds), { status: newStatus });
    if (success) {
      toast.success(`${selectedIds.size} samples updated to ${newStatus}`);
      setSelectedIds(new Set());
    } else {
      toast.error("Failed to update samples");
    }
  };

  // Handle ship with tracking
  const handleShipWithTracking = async () => {
    if (!trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }

    const ids = bulkActionTarget.length > 0 ? bulkActionTarget : (selectedSample ? [selectedSample.id] : []);
    
    if (ids.length === 0) return;

    const success = await updateMultiple(ids, { 
      status: "shipped", 
      tracking_number: trackingNumber.trim(),
      shipped_at: new Date().toISOString(),
    });

    if (success) {
      toast.success(`${ids.length} sample(s) marked as shipped`);
      setTrackingDialogOpen(false);
      setTrackingNumber("");
      setBulkActionTarget([]);
      setSelectedSample(null);
      setSelectedIds(new Set());
    } else {
      toast.error("Failed to update samples");
    }
  };

  // Export to CSV
  const handleExport = () => {
    window.open(`/api/samples?format=csv&status=${activeStatus === "all" ? "" : activeStatus}`, "_blank");
  };

  // Copy address to clipboard
  const copyAddress = (sample: SampleRequest) => {
    const address = [
      sample.requester_name,
      sample.practice_name,
      sample.shipping_address,
      `${sample.shipping_city}, ${sample.shipping_province} ${sample.shipping_postal_code}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  const queueCount = statusCounts.pending + statusCounts.approved;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Package className="w-6 h-6 text-orange-500" />
              Sample Requests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage sample fulfillment and shipping
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

            {/* Export Button */}
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>

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
              {statusCounts.pending} pending
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {statusCounts.approved} approved
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              <Truck className="w-3 h-3 mr-1" />
              {statusCounts.shipped} shipped
            </Badge>
          </div>
          {queueCount > 0 && (
            <div className="text-sm text-muted-foreground">
              {queueCount} item{queueCount !== 1 ? 's' : ''} to process
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b px-6 py-3 bg-muted/30">
        <div className="flex items-center gap-4">
          {/* Status Tabs */}
          <Tabs value={activeStatus} onValueChange={(v) => setActiveStatus(v as SampleStatus | "all")}>
            <TabsList>
              <TabsTrigger value="pending" className="gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Pending
                {statusCounts.pending > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{statusCounts.pending}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved
                {statusCounts.approved > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{statusCounts.approved}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="shipped" className="gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                Shipped
              </TabsTrigger>
              <TabsTrigger value="delivered" className="gap-1.5">
                <Box className="w-3.5 h-3.5" />
                Delivered
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, practice, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              {activeStatus === "pending" && (
                <Button size="sm" onClick={() => handleBulkStatusUpdate("approved")}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Approve All
                </Button>
              )}
              {activeStatus === "approved" && (
                <Button size="sm" onClick={() => {
                  setBulkActionTarget(Array.from(selectedIds));
                  setTrackingDialogOpen(true);
                }}>
                  <Truck className="w-3.5 h-3.5 mr-1.5" />
                  Ship All
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          )}
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
        ) : samples.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">No sample requests found</h3>
            <p className="text-sm text-muted-foreground">
              Sample requests from calls will appear here.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-6">
              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <Checkbox
                          checked={selectedIds.size === samples.length && samples.length > 0}
                          onCheckedChange={selectAll}
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Request</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Contact</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Shipping</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Products</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="w-10 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((sample) => {
                      const statusConfig = STATUS_CONFIG[sample.status];
                      const StatusIcon = statusConfig.icon;

                      return (
                        <tr key={sample.id} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedIds.has(sample.id)}
                              onCheckedChange={() => toggleSelection(sample.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{sample.requester_name}</p>
                            <p className="text-sm text-muted-foreground">{sample.practice_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(sample.created_at).toLocaleDateString()}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {sample.phone && (
                              <a href={`tel:${sample.phone}`} className="flex items-center gap-1 text-sm hover:text-blue-600">
                                <Phone className="w-3.5 h-3.5" />
                                {sample.phone}
                              </a>
                            )}
                            {sample.email && (
                              <a href={`mailto:${sample.email}`} className="flex items-center gap-1 text-sm hover:text-blue-600">
                                <Mail className="w-3.5 h-3.5" />
                                {sample.email}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              <p>{sample.shipping_address}</p>
                              <p className="text-muted-foreground">
                                {sample.shipping_city}, {sample.shipping_province} {sample.shipping_postal_code}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {sample.products_requested?.map((product, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {product}
                                </Badge>
                              ))}
                              {sample.quantity > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  x{sample.quantity}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className={cn("text-xs", statusConfig.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            {sample.tracking_number && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {sample.tracking_number}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {sample.status === "pending" && (
                                  <DropdownMenuItem onClick={() => handleStatusUpdate(sample, "approved")}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Approve
                                  </DropdownMenuItem>
                                )}
                                {sample.status === "approved" && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedSample(sample);
                                    setTrackingDialogOpen(true);
                                  }}>
                                    <Truck className="w-4 h-4 mr-2" />
                                    Ship with Tracking
                                  </DropdownMenuItem>
                                )}
                                {sample.status === "shipped" && (
                                  <DropdownMenuItem onClick={() => handleStatusUpdate(sample, "delivered")}>
                                    <Box className="w-4 h-4 mr-2" />
                                    Mark Delivered
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => copyAddress(sample)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy Address
                                </DropdownMenuItem>
                                {sample.notes && (
                                  <DropdownMenuItem onClick={() => setSelectedSample(sample)}>
                                    <FileText className="w-4 h-4 mr-2" />
                                    View Notes
                                  </DropdownMenuItem>
                                )}
                                {sample.tracking_number && (
                                  <DropdownMenuItem asChild>
                                    <a 
                                      href={`https://www.google.com/search?q=${encodeURIComponent(sample.tracking_number + " tracking")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      Track Package
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                {sample.status !== "cancelled" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleStatusUpdate(sample, "cancelled")}
                                      className="text-red-600"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Cancel
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => setPage(pagination.page - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasMore}
                      onClick={() => setPage(pagination.page + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Tracking Number Dialog */}
      <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tracking Number</DialogTitle>
            <DialogDescription>
              {bulkActionTarget.length > 1 
                ? `Enter tracking number for ${bulkActionTarget.length} samples`
                : selectedSample 
                  ? `Enter tracking number for ${selectedSample.requester_name}'s sample`
                  : "Enter the shipping tracking number"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="e.g., 1Z999AA10123456784"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTrackingDialogOpen(false);
              setTrackingNumber("");
              setBulkActionTarget([]);
              setSelectedSample(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleShipWithTracking}>
              <Truck className="w-4 h-4 mr-2" />
              Mark as Shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
