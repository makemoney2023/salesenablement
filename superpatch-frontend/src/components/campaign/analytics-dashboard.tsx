"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { CampaignCallRecord, CallStatus, CampaignStats } from "@/lib/campaign-storage";
import { TrendingUp, TrendingDown, Phone, Calendar, Clock, Target, Users, MapPin, CalendarDays, ChevronDown } from "lucide-react";
import { GaugeChart, RadialProgressChart, StatCard } from "./enhanced-charts";
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  format, 
  isWithinInterval,
  eachDayOfInterval,
  differenceInDays
} from "date-fns";

interface AnalyticsDashboardProps {
  records: Record<string, CampaignCallRecord>;
  stats: CampaignStats;
}

type DatePreset = "today" | "yesterday" | "last7days" | "last30days" | "thisMonth" | "allTime" | "custom";

interface DateRange {
  start: Date | null;
  end: Date | null;
  preset: DatePreset;
}

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7days", label: "Last 7 Days" },
  { id: "last30days", label: "Last 30 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "allTime", label: "All Time" },
];

function getDateRangeForPreset(preset: DatePreset): { start: Date | null; end: Date | null } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case "last7days":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last30days":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "thisMonth":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "allTime":
      return { start: null, end: null };
    case "custom":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    default:
      return { start: null, end: null };
  }
}

// Color palette for charts
const COLORS = {
  primary: "hsl(var(--primary))",
  completed: "#22c55e",
  booked: "#a855f7",
  failed: "#ef4444",
  queued: "#eab308",
  inProgress: "#3b82f6",
  notCalled: "#6b7280",
};

const STATUS_COLORS: Record<string, string> = {
  not_called: COLORS.notCalled,
  queued: COLORS.queued,
  in_progress: COLORS.inProgress,
  completed: COLORS.completed,
  booked: COLORS.booked,
  calendar_sent: COLORS.booked,
  failed: COLORS.failed,
};

export function AnalyticsDashboard({ records, stats }: AnalyticsDashboardProps) {
  // Date filter state - default to last 7 days
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    ...getDateRangeForPreset("last7days"),
    preset: "last7days",
  }));
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const recordsArray = useMemo(() => Object.values(records), [records]);

  // Filter records by date range
  const filteredRecords = useMemo(() => {
    if (!dateRange.start && !dateRange.end) {
      return recordsArray; // All time - no filter
    }
    return recordsArray.filter((record) => {
      const recordDate = new Date(record.created_at);
      if (dateRange.start && dateRange.end) {
        return isWithinInterval(recordDate, { start: dateRange.start, end: dateRange.end });
      }
      if (dateRange.start) {
        return recordDate >= dateRange.start;
      }
      if (dateRange.end) {
        return recordDate <= dateRange.end;
      }
      return true;
    });
  }, [recordsArray, dateRange]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    const total_calls = filteredRecords.length;
    const completed = filteredRecords.filter(r => r.status === "completed").length;
    const booked = filteredRecords.filter(r => ["booked", "calendar_sent"].includes(r.status)).length;
    const failed = filteredRecords.filter(r => r.status === "failed").length;
    const in_progress = filteredRecords.filter(r => r.status === "in_progress").length;
    const queued = filteredRecords.filter(r => r.status === "queued").length;
    
    const connectedCalls = filteredRecords.filter(r => 
      ["completed", "booked", "calendar_sent"].includes(r.status) && r.duration_seconds
    );
    const totalDuration = connectedCalls.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
    const avg_duration_seconds = connectedCalls.length > 0 ? Math.round(totalDuration / connectedCalls.length) : 0;
    
    const completedCount = completed + booked;
    const booking_rate = completedCount > 0 ? (booked / completedCount) * 100 : 0;

    return {
      total_calls,
      completed,
      booked,
      failed,
      in_progress,
      queued,
      avg_duration_seconds,
      booking_rate,
    };
  }, [filteredRecords]);

  // Handle preset selection
  const handlePresetSelect = (preset: DatePreset) => {
    const range = getDateRangeForPreset(preset);
    setDateRange({ ...range, preset });
    if (preset !== "custom") {
      setCustomStartDate("");
      setCustomEndDate("");
    }
  };

  // Handle custom date range
  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setDateRange({
        start: startOfDay(new Date(customStartDate)),
        end: endOfDay(new Date(customEndDate)),
        preset: "custom",
      });
    }
  };

  // Generate call volume over time data (dynamic based on date range)
  const volumeData = useMemo(() => {
    const days: Record<string, { date: string; fullDate: string; calls: number; completed: number; booked: number }> = {};
    
    // Determine date range for chart
    const chartEnd = dateRange.end || new Date();
    const chartStart = dateRange.start || subDays(chartEnd, 6);
    const dayCount = differenceInDays(chartEnd, chartStart) + 1;
    
    // Generate days in range (max 30 for readability)
    const daysToShow = Math.min(dayCount, 30);
    const interval = eachDayOfInterval({
      start: dayCount > 30 ? subDays(chartEnd, 29) : chartStart,
      end: chartEnd,
    });

    interval.forEach((day) => {
      const key = format(day, "yyyy-MM-dd");
      const dayLabel = daysToShow <= 7 
        ? format(day, "EEE") // "Mon", "Tue", etc.
        : format(day, "MM/dd"); // "01/15", etc.
      days[key] = { date: dayLabel, fullDate: key, calls: 0, completed: 0, booked: 0 };
    });

    // Count calls by day from filtered records
    filteredRecords.forEach((record) => {
      const date = format(new Date(record.created_at), "yyyy-MM-dd");
      if (days[date]) {
        days[date].calls++;
        if (["completed", "booked", "calendar_sent"].includes(record.status)) {
          days[date].completed++;
        }
        if (["booked", "calendar_sent"].includes(record.status)) {
          days[date].booked++;
        }
      }
    });

    return Object.values(days);
  }, [filteredRecords, dateRange]);

  // Get chart title based on date range
  const volumeChartTitle = useMemo(() => {
    if (dateRange.preset === "allTime") return "Call Volume (All Time)";
    if (dateRange.preset === "today") return "Call Volume (Today)";
    if (dateRange.preset === "yesterday") return "Call Volume (Yesterday)";
    if (dateRange.preset === "thisMonth") return "Call Volume (This Month)";
    if (dateRange.preset === "last30days") return "Call Volume (Last 30 Days)";
    if (dateRange.preset === "custom" && dateRange.start && dateRange.end) {
      return `Call Volume (${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d")})`;
    }
    return "Call Volume (Last 7 Days)";
  }, [dateRange]);

  // Outcome funnel data - use filtered stats
  const funnelData = useMemo(() => {
    return [
      { name: "Total Calls", value: filteredStats.total_calls, fill: COLORS.primary },
      { name: "Completed", value: filteredStats.completed + filteredStats.booked, fill: COLORS.completed },
      { name: "Booked", value: filteredStats.booked, fill: COLORS.booked },
    ];
  }, [filteredStats]);

  // Calls by practitioner type - use filtered records
  const typeData = useMemo(() => {
    const types: Record<string, number> = {};
    
    filteredRecords.forEach((record) => {
      const type = record.practitioner_type || "Unknown";
      types[type] = (types[type] || 0) + 1;
    });

    return Object.entries(types)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredRecords]);

  // Calls by province - use filtered records
  const provinceData = useMemo(() => {
    const provinces: Record<string, number> = {};
    
    filteredRecords.forEach((record) => {
      const province = record.province || "Unknown";
      provinces[province] = (provinces[province] || 0) + 1;
    });

    return Object.entries(provinces)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredRecords]);

  // Status distribution for pie chart - use filtered records
  const statusData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      completed: 0,
      booked: 0,
      failed: 0,
      in_progress: 0,
      queued: 0,
      not_called: 0,
    };

    filteredRecords.forEach((record) => {
      if (record.status === "calendar_sent") {
        statusCounts.booked++;
      } else {
        statusCounts[record.status]++;
      }
    });

    return [
      { name: "Completed", value: statusCounts.completed, fill: COLORS.completed },
      { name: "Booked", value: statusCounts.booked, fill: COLORS.booked },
      { name: "Failed", value: statusCounts.failed, fill: COLORS.failed },
      { name: "In Progress", value: statusCounts.in_progress, fill: COLORS.inProgress },
      { name: "Queued", value: statusCounts.queued, fill: COLORS.queued },
      { name: "Not Called", value: statusCounts.not_called, fill: COLORS.notCalled },
    ].filter((item) => item.value > 0);
  }, [filteredRecords]);

  // Best time to call heatmap data - use filtered records
  const heatmapData = useMemo(() => {
    const hours: Record<number, { connected: number; total: number }> = {};
    
    // Initialize hours 8 AM to 6 PM
    for (let h = 8; h <= 18; h++) {
      hours[h] = { connected: 0, total: 0 };
    }

    filteredRecords.forEach((record) => {
      if (record.call_started_at) {
        const hour = new Date(record.call_started_at).getHours();
        if (hours[hour]) {
          hours[hour].total++;
          if (["completed", "booked", "calendar_sent"].includes(record.status)) {
            hours[hour].connected++;
          }
        }
      }
    });

    return Object.entries(hours).map(([hour, data]) => ({
      hour: `${hour}:00`,
      calls: data.total,
      connected: data.connected,
      rate: data.total > 0 ? Math.round((data.connected / data.total) * 100) : 0,
    }));
  }, [filteredRecords]);

  // Chart configs
  const volumeChartConfig: ChartConfig = {
    calls: { label: "Total Calls", color: COLORS.primary },
    completed: { label: "Completed", color: COLORS.completed },
    booked: { label: "Booked", color: COLORS.booked },
  };

  const typeChartConfig: ChartConfig = {
    value: { label: "Calls", color: COLORS.primary },
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Date Filter */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="w-4 h-4" />
                <span className="font-medium">Date Range:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={dateRange.preset === preset.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetSelect(preset.id)}
                    className="h-8"
                  >
                    {preset.label}
                  </Button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={dateRange.preset === "custom" ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                    >
                      Custom
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                        />
                      </div>
                      <Button 
                        onClick={handleCustomDateApply} 
                        className="w-full"
                        disabled={!customStartDate || !customEndDate}
                      >
                        Apply Range
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {dateRange.start && dateRange.end && (
                <Badge variant="secondary" className="ml-auto">
                  {format(dateRange.start, "MMM d, yyyy")} - {format(dateRange.end, "MMM d, yyyy")}
                </Badge>
              )}
              {dateRange.preset === "allTime" && (
                <Badge variant="secondary" className="ml-auto">
                  All Time ({filteredRecords.length} records)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats Row - use filteredStats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Phone className="w-4 h-4" />
                Total Calls
              </div>
              <div className="text-2xl font-bold">{filteredStats.total_calls}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {filteredStats.in_progress} active, {filteredStats.queued} queued
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Target className="w-4 h-4" />
                Connection Rate
              </div>
              <div className="text-2xl font-bold text-green-600">
                {filteredStats.total_calls > 0 
                  ? Math.round(((filteredStats.completed + filteredStats.booked) / filteredStats.total_calls) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {filteredStats.completed + filteredStats.booked} connected calls
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Booking Rate
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {filteredStats.booking_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {filteredStats.booked} appointments booked
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="w-4 h-4" />
                Avg Duration
              </div>
              <div className="text-2xl font-bold">
                {filteredStats.avg_duration_seconds > 0
                  ? `${Math.floor(filteredStats.avg_duration_seconds / 60)}:${(filteredStats.avg_duration_seconds % 60).toString().padStart(2, "0")}`
                  : "0:00"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                per connected call
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Visual Metrics - use filteredStats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GaugeChart
            value={filteredStats.total_calls > 0 ? Math.round(((filteredStats.completed + filteredStats.booked) / filteredStats.total_calls) * 100) : 0}
            max={100}
            title="Connection Rate"
            subtitle="of all calls"
            color="hsl(142, 76%, 36%)"
            size="sm"
          />
          <GaugeChart
            value={Math.round(filteredStats.booking_rate)}
            max={100}
            title="Booking Rate"
            subtitle="of connected calls"
            color="hsl(262, 83%, 58%)"
            size="sm"
          />
          <Card className="flex flex-col items-center justify-center p-4">
            <RadialProgressChart
              data={[
                { name: "Completed", value: filteredStats.total_calls > 0 ? Math.round((filteredStats.completed / filteredStats.total_calls) * 100) : 0, fill: "hsl(142, 76%, 36%)" },
              ]}
              centerLabel="Completed"
              centerValue={filteredStats.completed}
            />
          </Card>
          <Card className="flex flex-col items-center justify-center p-4">
            <RadialProgressChart
              data={[
                { name: "Booked", value: filteredStats.completed > 0 ? Math.round((filteredStats.booked / filteredStats.completed) * 100) : 0, fill: "hsl(262, 83%, 58%)" },
              ]}
              centerLabel="Booked"
              centerValue={filteredStats.booked}
            />
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Call Volume Over Time - dynamic based on date filter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{volumeChartTitle}</CardTitle>
              <CardDescription>Daily call activity and outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={volumeChartConfig} className="h-[250px] w-full">
                <AreaChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stackId="1"
                    stroke={COLORS.primary}
                    fill={COLORS.primary}
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stackId="2"
                    stroke={COLORS.completed}
                    fill={COLORS.completed}
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="booked"
                    stackId="3"
                    stroke={COLORS.booked}
                    fill={COLORS.booked}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Outcome Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outcome Distribution</CardTitle>
              <CardDescription>Call status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={typeChartConfig} className="h-[250px] w-full">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Calls by Practitioner Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Calls by Practitioner Type
              </CardTitle>
              <CardDescription>Top 6 practitioner types</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={typeChartConfig} className="h-[250px] w-full">
                <BarChart data={typeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Calls by Province */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Calls by Province
              </CardTitle>
              <CardDescription>Geographic distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={typeChartConfig} className="h-[250px] w-full">
                <BarChart data={provinceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill={COLORS.completed} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Best Time to Call */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Best Time to Call
            </CardTitle>
            <CardDescription>Connection rate by hour (8 AM - 6 PM)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={volumeChartConfig} className="h-[200px] w-full">
              <BarChart data={heatmapData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="font-medium">{data.hour}</p>
                          <p className="text-sm text-muted-foreground">Calls: {data.calls}</p>
                          <p className="text-sm text-muted-foreground">Connected: {data.connected}</p>
                          <p className="text-sm text-green-600">Rate: {data.rate}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="calls" fill={COLORS.primary} radius={[4, 4, 0, 0]} opacity={0.3} />
                <Bar dataKey="connected" fill={COLORS.completed} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion Funnel</CardTitle>
            <CardDescription>From calls to bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-4 py-4">
              {funnelData.map((item, index) => (
                <div key={item.name} className="flex items-center">
                  <div className="text-center">
                    <div
                      className="mx-auto rounded-lg flex items-center justify-center text-white font-bold"
                      style={{
                        backgroundColor: item.fill,
                        width: `${120 - index * 20}px`,
                        height: `${80 - index * 15}px`,
                        fontSize: `${24 - index * 4}px`,
                      }}
                    >
                      {item.value}
                    </div>
                    <p className="text-sm font-medium mt-2">{item.name}</p>
                    {index > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {funnelData[index - 1].value > 0
                          ? Math.round((item.value / funnelData[index - 1].value) * 100)
                          : 0}% conversion
                      </p>
                    )}
                  </div>
                  {index < funnelData.length - 1 && (
                    <div className="mx-4 text-muted-foreground text-2xl">→</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
