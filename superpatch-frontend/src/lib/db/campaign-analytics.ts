import type { CallRecord, CampaignAnalytics } from "@/lib/db/types";

type CallRecordMetricsSource = Pick<
  CallRecord,
  "created_at" | "status" | "duration_seconds" | "appointment_booked"
>;

export function toLocalDateKey(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyDailyMetrics(date: string): Omit<CampaignAnalytics, "id" | "created_at"> {
  return {
    date,
    total_calls: 0,
    completed: 0,
    booked: 0,
    failed: 0,
    total_duration_seconds: 0,
    calls_answered: 0,
    calls_voicemail: 0,
    calls_no_answer: 0,
    avg_duration_seconds: 0,
    demos_booked: 0,
    samples_requested: 0,
    high_interest: 0,
    medium_interest: 0,
    low_interest: 0,
    answer_rate: 0,
    conversion_rate: 0,
    retries_scheduled: 0,
    retries_completed: 0,
    new_practitioners: 0,
    enriched_practitioners: 0,
  };
}

function aggregateRecordsForDate(
  date: string,
  records: CallRecordMetricsSource[],
): Omit<CampaignAnalytics, "id" | "created_at"> {
  const metrics = emptyDailyMetrics(date);

  for (const record of records) {
    metrics.total_calls += 1;

    if (
      record.status === "completed" ||
      record.status === "booked" ||
      record.status === "calendar_sent"
    ) {
      metrics.calls_answered += 1;
    }

    if (record.status === "completed") {
      metrics.completed += 1;
    } else if (record.status === "failed") {
      metrics.failed += 1;
    } else if (record.status === "voicemail") {
      metrics.calls_voicemail += 1;
    }

    if (record.appointment_booked) {
      metrics.booked += 1;
      metrics.demos_booked += 1;
    }

    metrics.total_duration_seconds += record.duration_seconds ?? 0;
  }

  metrics.avg_duration_seconds =
    metrics.total_calls > 0
      ? Math.round(metrics.total_duration_seconds / metrics.total_calls)
      : 0;
  metrics.answer_rate =
    metrics.total_calls > 0
      ? Math.round((metrics.calls_answered / metrics.total_calls) * 100) / 100
      : 0;
  metrics.conversion_rate =
    metrics.calls_answered > 0
      ? Math.round(((metrics.demos_booked) / metrics.calls_answered) * 100) / 100
      : 0;

  return metrics;
}

export function aggregateCallRecordsByDate(
  records: CallRecordMetricsSource[],
): Map<string, Omit<CampaignAnalytics, "id" | "created_at">> {
  const grouped = new Map<string, CallRecordMetricsSource[]>();

  for (const record of records) {
    const dateKey = toLocalDateKey(record.created_at);
    const bucket = grouped.get(dateKey) ?? [];
    bucket.push(record);
    grouped.set(dateKey, bucket);
  }

  const aggregated = new Map<string, Omit<CampaignAnalytics, "id" | "created_at">>();
  for (const [date, dateRecords] of grouped) {
    aggregated.set(date, aggregateRecordsForDate(date, dateRecords));
  }

  return aggregated;
}

function liveMetricsToReport(
  metrics: Omit<CampaignAnalytics, "id" | "created_at">,
  existing?: CampaignAnalytics,
): CampaignAnalytics {
  return {
    id: existing?.id ?? `live-${metrics.date}`,
    created_at: existing?.created_at ?? new Date().toISOString(),
    ...metrics,
    samples_requested: existing?.samples_requested ?? metrics.samples_requested,
    high_interest: existing?.high_interest ?? metrics.high_interest,
    medium_interest: existing?.medium_interest ?? metrics.medium_interest,
    low_interest: existing?.low_interest ?? metrics.low_interest,
    retries_scheduled: existing?.retries_scheduled ?? metrics.retries_scheduled,
    retries_completed: existing?.retries_completed ?? metrics.retries_completed,
    new_practitioners: existing?.new_practitioners ?? metrics.new_practitioners,
    enriched_practitioners: existing?.enriched_practitioners ?? metrics.enriched_practitioners,
  };
}

export function mergeDailyReports(
  storedReports: CampaignAnalytics[],
  liveByDate: Map<string, Omit<CampaignAnalytics, "id" | "created_at">>,
  todayDateKey: string,
): CampaignAnalytics[] {
  const merged = new Map<string, CampaignAnalytics>();

  for (const report of storedReports) {
    merged.set(report.date, report);
  }

  for (const [date, liveMetrics] of liveByDate) {
    const stored = merged.get(date);
    const shouldUseLive =
      !stored ||
      date === todayDateKey ||
      liveMetrics.total_calls > stored.total_calls;

    if (shouldUseLive && liveMetrics.total_calls > 0) {
      merged.set(date, liveMetricsToReport(liveMetrics, stored));
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
