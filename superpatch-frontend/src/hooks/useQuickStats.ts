"use client";

import { useEffect, useState, useCallback } from "react";
import { reconcileStaleInProgressRecords } from "@/lib/campaign-storage";

const STORAGE_KEY = "superpatch_campaign_calls";
const POLL_INTERVAL_MS = 10_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface QuickStats {
  activeCalls: number;
  queuedCalls: number;
  todayBooked: number;
}

/**
 * Sidebar-level quick stats for the Call Center nav indicator.
 *
 * The hook reads call records from localStorage (the operator-local
 * call ledger) and counts in-progress / queued / booked calls scoped to
 * today. It runs `reconcileStaleInProgressRecords()` on first mount and
 * before each poll tick so a stuck `in_progress` record (e.g. after an
 * abrupt hang-up or a webhook delivery that never landed) cannot keep
 * the green pulse lit indefinitely — regardless of which route the user
 * is currently on. Previously the reconciliation only ran on /campaign,
 * leaving the indicator stuck on every other route.
 */
export function useQuickStats(): QuickStats {
  const [stats, setStats] = useState<QuickStats>({
    activeCalls: 0,
    queuedCalls: 0,
    todayBooked: 0,
  });

  const loadStats = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const data = window.localStorage.getItem(STORAGE_KEY);
      if (!data) {
        setStats({ activeCalls: 0, queuedCalls: 0, todayBooked: 0 });
        return;
      }

      const records: Record<string, {
        status?: string;
        created_at?: string;
        updated_at?: string;
      }> = JSON.parse(data);
      const today = new Date().toDateString();
      const oneDayAgo = Date.now() - ONE_DAY_MS;

      let active = 0;
      let queued = 0;
      let booked = 0;
      let needsCleanup = false;

      for (const [, record] of Object.entries(records)) {
        const referenceIso = record.updated_at || record.created_at;
        if (!referenceIso) continue;
        const referenceDate = new Date(referenceIso).toDateString();
        const referenceTime = new Date(referenceIso).getTime();

        // Safety net: drop in_progress records older than 24h to `failed`.
        // This is the catch-all for the rare case where both the webhook
        // path and the reconciler missed a record.
        if (record.status === "in_progress" && referenceTime < oneDayAgo) {
          record.status = "failed";
          needsCleanup = true;
        }

        if (record.status === "in_progress" && referenceDate === today) {
          active++;
        }
        if (record.status === "queued") queued++;
        if (
          (record.status === "booked" || record.status === "calendar_sent") &&
          referenceDate === today
        ) {
          booked++;
        }
      }

      if (needsCleanup) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      }

      setStats({ activeCalls: active, queuedCalls: queued, todayBooked: booked });
    } catch (error) {
      console.error("Failed to load sidebar stats:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Run the reconciler immediately so a stuck `in_progress` from an
    // abrupt hang-up or a missed webhook clears the indicator within a
    // single tick. Then load stats. The reconciler internally caps its
    // work to records that have been in_progress past its own threshold,
    // so calling it on every tick is cheap when there's nothing stale.
    let cancelled = false;
    const tick = () => {
      reconcileStaleInProgressRecords()
        .catch((err) => {
          console.warn("[useQuickStats] reconcile failed:", err);
          return { reconciled: 0, ids: [] };
        })
        .finally(() => {
          if (!cancelled) loadStats();
        });
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);

    const handleStorage = () => loadStats();
    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadStats]);

  return stats;
}
