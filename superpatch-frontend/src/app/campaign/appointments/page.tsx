"use client";

import { useState, useMemo } from "react";
import { useAppointments, type AppointmentWithPractitioner } from "@/hooks/useAppointments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Loader2,
  MoreHorizontal,
  Phone,
  Mail,
  MapPin,
  Video,
  User,
  ExternalLink,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AppointmentStatus, AppointmentType, LocationType } from "@/lib/db/types";

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  scheduled: { label: "Scheduled", icon: Calendar, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  confirmed: { label: "Confirmed", icon: CalendarCheck, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  no_show: { label: "No Show", icon: AlertTriangle, color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  rescheduled: { label: "Rescheduled", icon: Clock, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
};

const TYPE_CONFIG: Record<AppointmentType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  demo: { label: "Demo Call", icon: Video },
  follow_up: { label: "Follow-up", icon: Phone },
  in_person: { label: "In-Person", icon: MapPin },
  other: { label: "Other", icon: Calendar },
};

const LOCATION_ICONS: Record<LocationType, React.ComponentType<{ className?: string }>> = {
  in_person: MapPin,
  phone: Phone,
  video: Video,
};

export default function AppointmentsPage() {
  const [activeStatus, setActiveStatus] = useState<AppointmentStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithPractitioner | null>(null);

  const {
    appointments,
    loading,
    error,
    isConnected,
    refresh,
    updateStatus,
    statusCounts,
  } = useAppointments({
    statusFilter: activeStatus,
  });

  // Filter appointments by search query
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        apt.title?.toLowerCase().includes(query) ||
        apt.attendee_name?.toLowerCase().includes(query) ||
        apt.attendee_email?.toLowerCase().includes(query) ||
        apt.practitioners?.name?.toLowerCase().includes(query)
      );
    });
  }, [appointments, searchQuery]);

  // Group appointments by date for calendar view
  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, AppointmentWithPractitioner[]> = {};
    filteredAppointments.forEach((apt) => {
      const dateKey = new Date(apt.scheduled_at).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });
    return grouped;
  }, [filteredAppointments]);

  // Get upcoming appointments count
  const upcomingCount = useMemo(() => {
    const now = new Date();
    return appointments.filter((apt) =>
      new Date(apt.scheduled_at) > now &&
      (apt.status === "scheduled" || apt.status === "confirmed")
    ).length;
  }, [appointments]);

  const handleStatusChange = async (apt: AppointmentWithPractitioner, newStatus: AppointmentStatus) => {
    const success = await updateStatus(apt.id, newStatus);
    if (success) {
      toast.success(`Appointment ${newStatus}`);
    } else {
      toast.error("Failed to update appointment");
    }
  };

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add padding for days before the first of the month
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }, [selectedDate]);

  const navigateMonth = (direction: "prev" | "next") => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-blue-500" />
              Appointments
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage scheduled demos and follow-up calls with practitioners
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

            {/* View Toggle */}
            <div className="flex items-center border rounded-lg">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-r-none"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="rounded-l-none"
              >
                <CalendarDays className="w-4 h-4" />
              </Button>
            </div>

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
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              <Calendar className="w-3 h-3 mr-1" />
              {upcomingCount} upcoming
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              <CalendarCheck className="w-3 h-3 mr-1" />
              {statusCounts.confirmed} confirmed
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {statusCounts.completed} completed
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {appointments.length} total appointment{appointments.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b px-6 py-3 bg-muted/30">
        <div className="flex items-center gap-4">
          {/* Status Tabs */}
          <Tabs value={activeStatus} onValueChange={(v) => setActiveStatus(v as AppointmentStatus | "all")}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="scheduled" className="gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Scheduled
                {statusCounts.scheduled > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{statusCounts.scheduled}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5" />
                Confirmed
                {statusCounts.confirmed > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{statusCounts.confirmed}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search appointments..."
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
        ) : viewMode === "list" ? (
          /* List View */
          filteredAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <CalendarDays className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-1">No appointments found</h3>
              <p className="text-sm text-muted-foreground">
                Appointments booked during calls will appear here.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-4">
                {filteredAppointments.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    onStatusChange={(status) => handleStatusChange(apt, status)}
                    onViewDetail={() => setSelectedAppointment(apt)}
                  />
                ))}
              </div>
            </ScrollArea>
          )
        ) : (
          /* Calendar View */
          <div className="p-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {selectedDate.toLocaleString("default", { month: "long", year: "numeric" })}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                      Today
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Day Headers */}
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar Days */}
                  {calendarDays.map((day, i) => {
                    const dateKey = day?.toDateString();
                    const dayAppointments = dateKey ? appointmentsByDate[dateKey] || [] : [];
                    
                    return (
                      <div
                        key={i}
                        className={cn(
                          "min-h-[100px] p-1 border rounded-md",
                          day && isToday(day) && "bg-blue-50 dark:bg-blue-950/20 border-blue-200",
                          !day && "bg-muted/30"
                        )}
                      >
                        {day && (
                          <>
                            <div className={cn(
                              "text-sm font-medium mb-1",
                              isToday(day) && "text-blue-600"
                            )}>
                              {day.getDate()}
                            </div>
                            <div className="space-y-1">
                              {dayAppointments.slice(0, 3).map((apt) => (
                                <div
                                  key={apt.id}
                                  className={cn(
                                    "text-xs px-1 py-0.5 rounded truncate cursor-pointer",
                                    STATUS_CONFIG[apt.status].color
                                  )}
                                  onClick={() => setSelectedAppointment(apt)}
                                >
                                  {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  {" "}
                                  {apt.attendee_name || apt.practitioners?.name || "Appointment"}
                                </div>
                              ))}
                              {dayAppointments.length > 3 && (
                                <div className="text-xs text-muted-foreground px-1">
                                  +{dayAppointments.length - 3} more
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedAppointment && (
        <AppointmentDetailDialog
          appointment={selectedAppointment}
          open={!!selectedAppointment}
          onOpenChange={(open) => !open && setSelectedAppointment(null)}
          onStatusChange={(status) => {
            handleStatusChange(selectedAppointment, status);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
}

// Appointment Card Component
interface AppointmentCardProps {
  appointment: AppointmentWithPractitioner;
  onStatusChange: (status: AppointmentStatus) => void;
  onViewDetail: () => void;
}

function AppointmentCard({ appointment, onStatusChange, onViewDetail }: AppointmentCardProps) {
  const statusConfig = STATUS_CONFIG[appointment.status];
  const typeConfig = TYPE_CONFIG[appointment.type];
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;
  const LocationIcon = appointment.location_type ? LOCATION_ICONS[appointment.location_type] : Phone;

  const scheduledDate = new Date(appointment.scheduled_at);
  const isPast = scheduledDate < new Date();

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onViewDetail}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Time and Details */}
          <div className="flex gap-4">
            {/* Time Box */}
            <div className={cn(
              "flex flex-col items-center justify-center w-20 h-20 rounded-lg border-2",
              isPast && appointment.status !== "completed" ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20" : "border-muted"
            )}>
              <span className="text-xs text-muted-foreground uppercase">
                {scheduledDate.toLocaleDateString([], { month: "short" })}
              </span>
              <span className="text-2xl font-bold">
                {scheduledDate.getDate()}
              </span>
              <span className="text-xs font-medium">
                {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Details */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={cn("shrink-0", statusConfig.color)}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                <Badge variant="secondary" className="shrink-0">
                  <TypeIcon className="w-3 h-3 mr-1" />
                  {typeConfig.label}
                </Badge>
              </div>

              <h3 className="font-medium">
                {appointment.title || `${typeConfig.label} Appointment`}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {(appointment.attendee_name || appointment.practitioners?.name) && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {appointment.attendee_name || appointment.practitioners?.name}
                  </span>
                )}
                {appointment.location_type && (
                  <span className="flex items-center gap-1">
                    <LocationIcon className="w-3.5 h-3.5" />
                    {appointment.location_type === "in_person" ? "In-person" :
                     appointment.location_type === "phone" ? "Phone call" : "Video call"}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {appointment.duration_minutes} min
                </span>
              </div>
            </div>
          </div>

          {/* Right side - Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {appointment.status === "scheduled" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("confirmed"); }}>
                  <CalendarCheck className="w-4 h-4 mr-2" />
                  Confirm
                </DropdownMenuItem>
              )}
              {(appointment.status === "scheduled" || appointment.status === "confirmed") && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("completed"); }}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("no_show"); }}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    No Show
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("cancelled"); }} className="text-red-600">
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </DropdownMenuItem>
                </>
              )}
              {appointment.attendee_email && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href={`mailto:${appointment.attendee_email}`} onClick={(e) => e.stopPropagation()}>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email
                    </a>
                  </DropdownMenuItem>
                </>
              )}
              {appointment.attendee_phone && (
                <DropdownMenuItem asChild>
                  <a href={`tel:${appointment.attendee_phone}`} onClick={(e) => e.stopPropagation()}>
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
            {appointment.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Detail Dialog
interface AppointmentDetailDialogProps {
  appointment: AppointmentWithPractitioner;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: AppointmentStatus) => void;
}

function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  onStatusChange,
}: AppointmentDetailDialogProps) {
  const statusConfig = STATUS_CONFIG[appointment.status];
  const typeConfig = TYPE_CONFIG[appointment.type];
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;
  const scheduledDate = new Date(appointment.scheduled_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
          <DialogTitle>{appointment.title || `${typeConfig.label} Appointment`}</DialogTitle>
          <DialogDescription>
            {scheduledDate.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" at "}
            {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" • "}
            {appointment.duration_minutes} minutes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Attendee Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Attendee</h4>
            <div className="space-y-1 text-sm">
              {appointment.attendee_name && (
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  {appointment.attendee_name}
                </p>
              )}
              {appointment.attendee_email && (
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${appointment.attendee_email}`} className="text-blue-600 hover:underline">
                    {appointment.attendee_email}
                  </a>
                </p>
              )}
              {appointment.attendee_phone && (
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${appointment.attendee_phone}`} className="text-blue-600 hover:underline">
                    {appointment.attendee_phone}
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Practitioner Info */}
          {appointment.practitioners && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Practice</h4>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  {appointment.practitioners.name}
                </p>
                {appointment.practitioners.practitioner_type && (
                  <p className="text-muted-foreground pl-6">
                    {appointment.practitioners.practitioner_type}
                  </p>
                )}
                {appointment.practitioners.city && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {appointment.practitioners.city}, {appointment.practitioners.province}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {appointment.location_type && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Location</h4>
              <p className="text-sm">
                {appointment.location_type === "in_person" && "In-person meeting"}
                {appointment.location_type === "phone" && "Phone call"}
                {appointment.location_type === "video" && "Video call"}
                {appointment.location_address && ` - ${appointment.location_address}`}
              </p>
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Notes</h4>
              <p className="text-sm text-muted-foreground">{appointment.notes}</p>
            </div>
          )}

          {/* Products Interested */}
          {appointment.products_interested && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Products Interested</h4>
              <p className="text-sm">{appointment.products_interested}</p>
            </div>
          )}

          {/* Cal.com Link */}
          {appointment.cal_booking_uid && (
            <div className="pt-2 border-t">
              <a
                href={`https://app.cal.com/booking/${appointment.cal_booking_uid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View in Cal.com
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          {appointment.status === "scheduled" && (
            <>
              <Button variant="outline" onClick={() => onStatusChange("cancelled")}>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={() => onStatusChange("confirmed")}>
                <CalendarCheck className="w-4 h-4 mr-2" />
                Confirm
              </Button>
            </>
          )}
          {appointment.status === "confirmed" && (
            <>
              <Button variant="outline" onClick={() => onStatusChange("no_show")}>
                <AlertTriangle className="w-4 h-4 mr-2" />
                No Show
              </Button>
              <Button onClick={() => onStatusChange("completed")}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete
              </Button>
            </>
          )}
          {(appointment.status === "completed" || appointment.status === "cancelled") && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
