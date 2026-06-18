import { toLocalDateKey } from "@/lib/db/campaign-analytics";

/**
 * Buckets call records into the last `days` local calendar days, returning a
 * `number[]` of length `days` ordered oldest -> newest where the LAST element is
 * today. Records outside the window are ignored. Used to drive the Total Calls
 * sparkline with real per-day counts instead of synthetic data.
 */
export function computeRecentCallCounts(
  records: Array<{ created_at: string }>,
  days: number,
): number[] {
  const counts = new Array<number>(days).fill(0);
  if (days <= 0) return counts;

  const today = new Date();
  const dayKeys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    dayKeys.push(toLocalDateKey(d.toISOString()));
  }

  const indexByKey = new Map<string, number>();
  dayKeys.forEach((key, index) => indexByKey.set(key, index));

  for (const record of records) {
    if (!record?.created_at) continue;
    const key = toLocalDateKey(record.created_at);
    const index = indexByKey.get(key);
    if (index !== undefined) {
      counts[index] += 1;
    }
  }

  return counts;
}
