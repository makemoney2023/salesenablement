"use client";

import { useState, useMemo } from "react";
import { useDailyReports } from "@/hooks/useDailyReports";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Phone,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  AlertTriangle,
  Minus,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignAnalytics } from "@/lib/db/types";

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<"7" | "14" | "30" | "90">("30");

  const startDate = useMemo(() => {
    const days = parseInt(dateRange);
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }, [dateRange]);

  const {
    reports,
    loading,
    error,
    isConnected,
    refresh,
    aggregateStats,
    trends,
  } = useDailyReports({
    startDate,
    endDate: new Date(),
  });

  // Format duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Get trend icon and color
  const getTrendDisplay = (trend: { direction: "up" | "down" | "neutral"; percentage: number }) => {
    if (trend.direction === "up") {
      return {
        icon: TrendingUp,
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
      };
    } else if (trend.direction === "down") {
      return {
        icon: TrendingDown,
        color: "text-red-600",
        bgColor: "bg-red-100 dark:bg-red-900/30",
      };
    }
    return {
      icon: Minus,
      color: "text-gray-500",
      bgColor: "bg-gray-100 dark:bg-gray-800",
    };
  };

  // Sort reports by date descending for display
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reports]);

  // Calculate chart data (last 14 data points for sparkline)
  const chartData = useMemo(() => {
    const last14 = [...reports]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14);
    
    const maxCalls = Math.max(...last14.map((r) => r.total_calls), 1);
    return last14.map((r) => ({
      date: r.date,
      calls: r.total_calls,
      height: (r.total_calls / maxCalls) * 100,
    }));
  }, [reports]);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-500" />
              Daily Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Campaign performance analytics and trends
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

            {/* Date Range Selector */}
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as "7" | "14" | "30" | "90")}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
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
        ) : (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Aggregate Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Calls */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-500" />
                      Total Calls
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-bold">{aggregateStats.totalCalls.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          ~{aggregateStats.avgCallsPerDay} per day
                        </p>
                      </div>
                      <TrendBadge trend={trends.calls} />
                    </div>
                  </CardContent>
                </Card>

                {/* Bookings */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-green-500" />
                      Appointments Booked
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-bold">{aggregateStats.totalBooked.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {aggregateStats.bookingRate.toFixed(1)}% booking rate
                        </p>
                      </div>
                      <TrendBadge trend={trends.bookings} />
                    </div>
                  </CardContent>
                </Card>

                {/* Success Rate */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-500" />
                      Success Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-bold">{aggregateStats.successRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">
                          {aggregateStats.totalCompleted} completed / {aggregateStats.totalFailed} failed
                        </p>
                      </div>
                      <TrendBadge trend={trends.successRate} />
                    </div>
                  </CardContent>
                </Card>

                {/* Avg Duration */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      Avg Call Duration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <p className="text-3xl font-bold">{formatDuration(aggregateStats.avgDurationSeconds)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDuration(aggregateStats.totalDurationSeconds)} total
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Activity Chart (Simple Bar Visualization) */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Call Activity (Last 14 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-1 h-24">
                      {chartData.map((data, i) => (
                        <div
                          key={data.date}
                          className="flex-1 group relative"
                        >
                          <div
                            className={cn(
                              "w-full rounded-t transition-all",
                              data.calls > 0 ? "bg-blue-500 hover:bg-blue-600" : "bg-muted"
                            )}
                            style={{ height: `${Math.max(data.height, 4)}%` }}
                          />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                            <div className="bg-popover border shadow-lg rounded px-2 py-1 text-xs whitespace-nowrap">
                              <p className="font-medium">{new Date(data.date).toLocaleDateString()}</p>
                              <p>{data.calls} calls</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>{chartData[0]?.date ? new Date(chartData[0].date).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</span>
                      <span>{chartData[chartData.length - 1]?.date ? new Date(chartData[chartData.length - 1].date).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Daily Breakdown Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Daily Breakdown</CardTitle>
                  <CardDescription>
                    Detailed statistics for each day
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sortedReports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p>No data available for selected period</p>
                      <p className="text-sm">Data is generated by the daily report Edge Function</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total Calls</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Completed</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Booked</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Failed</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Success Rate</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedReports.map((report) => {
                            const totalAttempted = report.completed + report.failed;
                            const successRate = totalAttempted > 0 ? (report.completed / totalAttempted) * 100 : 0;
                            const avgDuration = report.total_calls > 0 
                              ? Math.round(report.total_duration_seconds / report.total_calls) 
                              : 0;

                            return (
                              <tr key={report.id} className="border-b hover:bg-muted/30">
                                <td className="py-3 px-4">
                                  <span className="font-medium">
                                    {new Date(report.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="flex items-center justify-end gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                                    {report.total_calls}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="flex items-center justify-end gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    {report.completed}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="flex items-center justify-end gap-1.5">
                                    <CalendarCheck className="w-3.5 h-3.5 text-purple-500" />
                                    {report.booked}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="flex items-center justify-end gap-1.5">
                                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                                    {report.failed}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Badge variant="secondary" className={cn(
                                    successRate >= 70 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                                    successRate >= 50 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                  )}>
                                    {successRate.toFixed(0)}%
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-right text-muted-foreground">
                                  {formatDuration(avgDuration)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// Trend Badge Component
function TrendBadge({ trend }: { trend: { direction: "up" | "down" | "neutral"; percentage: number } }) {
  const display = getTrendDisplay(trend);
  const TrendIcon = display.icon;

  if (trend.direction === "neutral") {
    return null;
  }

  return (
    <Badge variant="secondary" className={cn("text-xs", display.bgColor, display.color)}>
      <TrendIcon className="w-3 h-3 mr-1" />
      {trend.percentage.toFixed(0)}%
    </Badge>
  );
}

function getTrendDisplay(trend: { direction: "up" | "down" | "neutral"; percentage: number }) {
  if (trend.direction === "up") {
    return {
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    };
  } else if (trend.direction === "down") {
    return {
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    };
  }
  return {
    icon: Minus,
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  };
}
