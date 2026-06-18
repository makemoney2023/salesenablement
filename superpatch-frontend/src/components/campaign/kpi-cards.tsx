"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PhoneCall,
  PhoneIncoming,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  status?: "success" | "warning" | "danger" | "neutral";
  sparklineData?: number[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 24;
  const padding = 2;
  
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  status = "neutral",
  sparklineData,
}: KPICardProps) {
  const statusColors = {
    success: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
    warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
    danger: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    neutral: "bg-card border-border",
  };

  const iconColors = {
    success: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    danger: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
  };

  const sparklineColors = {
    success: "#22c55e",
    warning: "#eab308",
    danger: "#ef4444",
    neutral: "#6b7280",
  };

  return (
    <Card className={cn("border transition-all hover:shadow-md", statusColors[status])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("w-4 h-4", iconColors[status])} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {title}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{value}</span>
              {trend && (
                <div className="flex items-center gap-0.5">
                  {trend.value === 0 ? (
                    <Minus className="w-3 h-3 text-muted-foreground" />
                  ) : trend.isPositive ? (
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-600" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      trend.value === 0
                        ? "text-muted-foreground"
                        : trend.isPositive
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    {trend.value > 0 ? "+" : ""}
                    {trend.value}%
                  </span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend?.label && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{trend.label}</p>
            )}
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="flex-shrink-0 ml-2">
              <MiniSparkline data={sparklineData} color={sparklineColors[status]} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CampaignStats {
  total_calls: number;
  completed: number;
  booked: number;
  calendar_sent: number;
  failed: number;
  in_progress: number;
  queued: number;
  booking_rate: number;
  avg_duration_seconds?: number;
}

interface KPICardsProps {
  stats: CampaignStats;
  previousStats?: CampaignStats;
  callsToday?: number;
  callsYesterday?: number;
  recentCallCounts?: number[]; // Last 7 days call counts for sparkline
}

export function KPICards({
  stats,
  previousStats,
  callsToday = 0,
  callsYesterday = 0,
  recentCallCounts = [],
}: KPICardsProps) {
  // Calculate trends
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: current > 0 ? 100 : 0, isPositive: current > 0 };
    const percentChange = ((current - previous) / previous) * 100;
    return {
      value: Math.round(percentChange),
      isPositive: percentChange >= 0,
    };
  };

  // Connection rate (completed / total calls)
  const connectionRate = stats.total_calls > 0 
    ? Math.round((stats.completed / stats.total_calls) * 100)
    : 0;
  
  const prevConnectionRate = previousStats && previousStats.total_calls > 0
    ? Math.round((previousStats.completed / previousStats.total_calls) * 100)
    : 0;

  // Format duration
  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Determine status based on values
  const getBookingStatus = (rate: number): "success" | "warning" | "danger" | "neutral" => {
    if (rate >= 10) return "success";
    if (rate >= 5) return "warning";
    if (rate > 0) return "neutral";
    return "neutral";
  };

  const getConnectionStatus = (rate: number): "success" | "warning" | "danger" | "neutral" => {
    if (rate >= 70) return "success";
    if (rate >= 50) return "warning";
    if (rate > 0) return "neutral";
    return "neutral";
  };

  const todayTrend = calculateTrend(callsToday, callsYesterday);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Total Calls */}
      <KPICard
        title="Total Calls"
        value={stats.total_calls.toLocaleString()}
        icon={PhoneCall}
        subtitle={`${stats.in_progress} active, ${stats.queued} queued`}
        sparklineData={recentCallCounts}
        status={stats.total_calls > 0 ? "neutral" : "neutral"}
        trend={previousStats ? calculateTrend(stats.total_calls, previousStats.total_calls) : undefined}
      />

      {/* Today's Calls */}
      <KPICard
        title="Today"
        value={callsToday.toLocaleString()}
        icon={Clock}
        subtitle={`vs ${callsYesterday} yesterday`}
        status={callsToday > callsYesterday ? "success" : callsToday < callsYesterday ? "warning" : "neutral"}
        trend={{
          ...todayTrend,
          label: "vs yesterday",
        }}
      />

      {/* Connection Rate */}
      <KPICard
        title="Connection Rate"
        value={`${connectionRate}%`}
        icon={PhoneIncoming}
        subtitle={`${stats.completed} connected`}
        status={getConnectionStatus(connectionRate)}
        trend={previousStats ? {
          value: connectionRate - prevConnectionRate,
          isPositive: connectionRate >= prevConnectionRate,
        } : undefined}
      />

      {/* Booked Appointments */}
      <KPICard
        title="Booked"
        value={stats.booked.toLocaleString()}
        icon={CalendarCheck}
        subtitle={`${stats.calendar_sent} calendar sent`}
        status={stats.booked > 0 ? "success" : "neutral"}
        trend={previousStats ? calculateTrend(stats.booked, previousStats.booked) : undefined}
      />

      {/* Booking Rate */}
      <KPICard
        title="Booking Rate"
        value={`${stats.booking_rate.toFixed(1)}%`}
        icon={Target}
        subtitle={`${stats.booked} of ${stats.completed} calls`}
        status={getBookingStatus(stats.booking_rate)}
      />

      {/* Avg Call Duration */}
      <KPICard
        title="Avg Duration"
        value={formatDuration(stats.avg_duration_seconds)}
        icon={Clock}
        subtitle="per connected call"
        status="neutral"
      />
    </div>
  );
}

// Compact version for smaller spaces
export function KPICardsCompact({ stats }: { stats: CampaignStats }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
        <PhoneCall className="w-3 h-3" />
        <span className="font-semibold">{stats.total_calls}</span>
        <span className="text-muted-foreground">calls</span>
      </Badge>
      <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-green-50 border-green-200 text-green-700">
        <TrendingUp className="w-3 h-3" />
        <span className="font-semibold">{stats.completed}</span>
        <span>completed</span>
      </Badge>
      <Badge variant="outline" className="gap-1.5 py-1 px-2.5 bg-purple-50 border-purple-200 text-purple-700">
        <CalendarCheck className="w-3 h-3" />
        <span className="font-semibold">{stats.booked}</span>
        <span>booked</span>
      </Badge>
      <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
        <Target className="w-3 h-3" />
        <span className="font-semibold">{stats.booking_rate.toFixed(1)}%</span>
        <span className="text-muted-foreground">rate</span>
      </Badge>
    </div>
  );
}
