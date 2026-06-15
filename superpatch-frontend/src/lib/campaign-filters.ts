/**
 * Pure helpers for client-side campaign list filtering.
 *
 * Extracted from the campaign page so the "has website" and call-status
 * filters can be unit-tested independently of the React component.
 */
import type { CallStatus } from "@/lib/db/types";

/**
 * Whether a practitioner's call status matches the selected status filter.
 * An empty filter matches everything; a missing status is treated as
 * "not_called".
 */
export function matchesCallStatus(
  status: CallStatus | string | undefined,
  callStatusFilter: CallStatus[]
): boolean {
  if (callStatusFilter.length === 0) return true;
  return callStatusFilter.includes((status || "not_called") as CallStatus);
}

interface ListFilterOptions {
  hasWebsiteOnly: boolean;
  callStatusFilter: CallStatus[];
  callRecords: Record<string, { status?: CallStatus | string } | undefined>;
}

/**
 * Applies the "has website" and call-status filters to a practitioner list.
 */
export function applyListFilters<
  T extends { id: string; website?: string | null }
>(practitioners: T[], opts: ListFilterOptions): T[] {
  let result = practitioners;

  if (opts.hasWebsiteOnly) {
    result = result.filter((p) => Boolean(p.website));
  }

  if (opts.callStatusFilter.length > 0) {
    result = result.filter((p) =>
      matchesCallStatus(opts.callRecords[p.id]?.status, opts.callStatusFilter)
    );
  }

  return result;
}
