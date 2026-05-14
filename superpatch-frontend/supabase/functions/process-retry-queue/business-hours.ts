// Business-hours gate for the retry queue.
//
// Pure function so it can be unit-tested without timers. The previous inline
// implementation in index.ts returned `true` (allow calls) when the timezone
// formatter threw — which during a DST transition or with a typo'd timezone
// could let after-hours dials slip through. This module is fail-closed: any
// error path returns `false` (don't dial).

const DEFAULT_BUSINESS_HOURS = { start: 9, end: 17 } as const;

export function isWithinBusinessHours(
  timezone: string,
  now: Date = new Date(),
  hours: { start: number; end: number } = DEFAULT_BUSINESS_HOURS,
): boolean {
  let hour: number;
  let weekday: string;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour")?.value ?? "";
    const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "";

    const parsedHour = Number.parseInt(hourPart, 10);
    if (!Number.isFinite(parsedHour)) {
      // Fail closed: parsing produced a non-finite value -> assume out of hours.
      return false;
    }
    hour = parsedHour;
    weekday = weekdayPart;
  } catch (err) {
    // Intl.DateTimeFormat threw (invalid timezone, runtime issue, etc.). Fail
    // closed and don't dial. The retry-queue logger should see the warning.
    console.warn(
      "[business-hours] failed to evaluate window, refusing to dial:",
      err,
    );
    return false;
  }

  if (weekday === "Sat" || weekday === "Sun") return false;
  // Note: hour 24 (midnight rollover) is also rejected by the strict `<`.
  return hour >= hours.start && hour < hours.end;
}
