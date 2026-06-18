import { describe, it, expect } from "vitest";
import {
  toLocalDateKey,
  aggregateCallRecordsByDate,
  mergeDailyReports,
} from "@/lib/db/campaign-analytics";
import type { CallRecord, CampaignAnalytics } from "@/lib/db/types";

function makeCallRecord(overrides: Partial<CallRecord> = {}): CallRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    practitioner_id: "p1",
    practitioner_name: "Test Clinic",
    practitioner_type: "chiropractor",
    phone: "+15551234567",
    address: null,
    city: null,
    province: null,
    call_id: null,
    status: "completed",
    call_started_at: null,
    call_ended_at: null,
    duration_seconds: 60,
    transcript: null,
    summary: null,
    appointment_booked: false,
    appointment_time: null,
    calendar_invite_sent: false,
    practitioner_email: null,
    booking_id: null,
    notes: null,
    sentiment_score: null,
    sentiment_label: null,
    recording_url: null,
    lead_score: 0,
    llm_analysis: null,
    llm_lead_score: null,
    llm_analyzed_at: null,
    analysis_status: null,
    processed_at: null,
    created_at: "2026-06-18T15:00:00.000Z",
    updated_at: "2026-06-18T15:00:00.000Z",
    ...overrides,
  };
}

function makeStoredReport(overrides: Partial<CampaignAnalytics> = {}): CampaignAnalytics {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    date: "2026-06-18",
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
    created_at: "2026-06-18T08:00:00.000Z",
    ...overrides,
  };
}

describe("toLocalDateKey", () => {
  it("returns YYYY-MM-DD in local timezone", () => {
    const key = toLocalDateKey("2026-06-18T15:00:00.000Z");
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("aggregateCallRecordsByDate", () => {
  it("groups records by local date and counts metrics", () => {
    const records = [
      makeCallRecord({ id: "1", status: "completed", duration_seconds: 90, appointment_booked: true }),
      makeCallRecord({ id: "2", status: "failed", duration_seconds: 30, created_at: "2026-06-18T16:00:00.000Z" }),
      makeCallRecord({ id: "3", status: "voicemail", duration_seconds: 15, created_at: "2026-06-17T16:00:00.000Z" }),
    ];

    const byDate = aggregateCallRecordsByDate(records);
    const todayKey = toLocalDateKey("2026-06-18T15:00:00.000Z");
    const yesterdayKey = toLocalDateKey("2026-06-17T16:00:00.000Z");

    expect(byDate.get(todayKey)?.total_calls).toBe(2);
    expect(byDate.get(todayKey)?.completed).toBe(1);
    expect(byDate.get(todayKey)?.failed).toBe(1);
    expect(byDate.get(todayKey)?.booked).toBe(1);
    expect(byDate.get(todayKey)?.total_duration_seconds).toBe(120);

    expect(byDate.get(yesterdayKey)?.total_calls).toBe(1);
    expect(byDate.get(yesterdayKey)?.calls_voicemail).toBe(1);
  });
});

describe("mergeDailyReports", () => {
  it("prefers live data when stored report is missing for a date", () => {
    const live = aggregateCallRecordsByDate([
      makeCallRecord({ id: "1", status: "completed" }),
      makeCallRecord({ id: "2", status: "completed" }),
    ]);

    const merged = mergeDailyReports([], live, "2026-06-18");

    expect(merged).toHaveLength(1);
    expect(merged[0].total_calls).toBe(2);
    expect(merged[0].completed).toBe(2);
  });

  it("prefers live data for today even when stored report exists", () => {
    const stored = [
      makeStoredReport({ date: "2026-06-18", total_calls: 0, completed: 0 }),
    ];
    const live = aggregateCallRecordsByDate([
      makeCallRecord({ id: "1", status: "completed" }),
      makeCallRecord({ id: "2", status: "failed" }),
    ]);

    const merged = mergeDailyReports(stored, live, "2026-06-18");

    expect(merged[0].total_calls).toBe(2);
    expect(merged[0].completed).toBe(1);
    expect(merged[0].failed).toBe(1);
  });

  it("keeps stored historical report when live has no newer calls", () => {
    const stored = [
      makeStoredReport({
        date: "2026-06-17",
        total_calls: 5,
        completed: 4,
        samples_requested: 2,
      }),
    ];
    const live = aggregateCallRecordsByDate([]);

    const merged = mergeDailyReports(stored, live, "2026-06-18");

    expect(merged).toHaveLength(1);
    expect(merged[0].total_calls).toBe(5);
    expect(merged[0].samples_requested).toBe(2);
  });
});
