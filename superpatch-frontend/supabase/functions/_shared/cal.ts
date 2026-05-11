// Cal.com v2 HTTP client for Supabase Edge Functions.
//
// Source of truth for Cal IDs / event type id lives in
// b2b_sales_enablement/bland_ai_pathways/canonical_ids.json. Consumers must
// pass apiKey + eventTypeId in; this module owns nothing but the HTTP shape.
//
// Cal.com v1 was retired 2026-04-08. All requests target /v2 with the
// `cal-api-version` header (default 2026-02-25).

export interface CalBookingRequest {
  eventTypeId: number;
  start: string;
  attendee: {
    name: string;
    email: string;
    timeZone: string;
    phoneNumber?: string;
  };
  metadata?: Record<string, string>;
  lengthInMinutes?: number;
}

export interface CalBookingAttendee {
  name: string;
  email: string;
  timeZone: string;
  phoneNumber?: string;
}

export interface CalBookingResult {
  id: number;
  uid: string;
  status: string;
  start?: string;
  end?: string;
  attendees?: CalBookingAttendee[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
}

export interface CalClientOptions {
  apiKey: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface ListCalBookingsParams {
  afterStart?: string;
  beforeStart?: string;
  status?: string;
  take?: number;
}

export class CalError extends Error {
  override name = "CalError";
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const CAL_BASE_URL = "https://api.cal.com/v2";
const DEFAULT_API_VERSION = "2026-02-25";
const DEFAULT_TIMEOUT_MS = 15000;

function buildHeaders(opts: CalClientOptions): Headers {
  const headers = new Headers({
    "Authorization": `Bearer ${opts.apiKey}`,
    "cal-api-version": opts.apiVersion ?? DEFAULT_API_VERSION,
    "Content-Type": "application/json",
  });
  return headers;
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") return b.message;
    const err = b.error;
    if (err && typeof err === "object") {
      const m = (err as Record<string, unknown>).message;
      if (typeof m === "string") return m;
    }
    if (typeof b.error === "string") return b.error;
  }
  return `Cal.com request failed with status ${status}`;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  opts: CalClientOptions,
): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      throw new CalError(response.status, extractErrorMessage(parsed, response.status), parsed);
    }

    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function unwrapBookingPayload(body: unknown): CalBookingResult {
  const root = (body && typeof body === "object") ? body as Record<string, unknown> : {};
  const data = (root.data && typeof root.data === "object") ? root.data as Record<string, unknown> : root;

  const id = typeof data.id === "number" ? data.id : Number(data.id);
  const uid = typeof data.uid === "string" ? data.uid : String(data.uid ?? "");
  const status = typeof data.status === "string" ? data.status : String(data.status ?? "");
  const start = typeof data.start === "string" ? data.start : undefined;
  const end = typeof data.end === "string" ? data.end : undefined;
  const title = typeof data.title === "string" ? data.title : undefined;
  const createdAt = typeof data.createdAt === "string" ? data.createdAt : undefined;
  const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : undefined;
  const metadata = (data.metadata && typeof data.metadata === "object")
    ? data.metadata as Record<string, unknown>
    : undefined;

  let attendees: CalBookingAttendee[] | undefined;
  if (Array.isArray(data.attendees)) {
    attendees = data.attendees
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      .map((entry) => ({
        name: typeof entry.name === "string" ? entry.name : "",
        email: typeof entry.email === "string" ? entry.email : "",
        timeZone: typeof entry.timeZone === "string" ? entry.timeZone : "",
        phoneNumber: typeof entry.phoneNumber === "string" ? entry.phoneNumber : undefined,
      }));
  }

  return { id, uid, status, start, end, title, createdAt, updatedAt, metadata, attendees };
}

export async function createCalBooking(
  req: CalBookingRequest,
  opts: CalClientOptions,
): Promise<CalBookingResult> {
  const body = await fetchJson(
    `${CAL_BASE_URL}/bookings`,
    {
      method: "POST",
      headers: buildHeaders(opts),
      body: JSON.stringify(req),
    },
    opts,
  );
  return unwrapBookingPayload(body);
}

export async function listCalBookings(
  params: ListCalBookingsParams,
  opts: CalClientOptions,
): Promise<{ bookings: CalBookingResult[] }> {
  const search = new URLSearchParams();
  if (params.afterStart) search.set("afterStart", params.afterStart);
  if (params.beforeStart) search.set("beforeStart", params.beforeStart);
  if (params.status) search.set("status", params.status);
  if (typeof params.take === "number") search.set("take", String(params.take));

  const qs = search.toString();
  const url = qs ? `${CAL_BASE_URL}/bookings?${qs}` : `${CAL_BASE_URL}/bookings`;

  const body = await fetchJson(
    url,
    { method: "GET", headers: buildHeaders(opts) },
    opts,
  );

  const root = (body && typeof body === "object") ? body as Record<string, unknown> : {};
  let rawList: unknown = null;
  if (Array.isArray(root.data)) {
    rawList = root.data;
  } else if (root.data && typeof root.data === "object" && Array.isArray((root.data as Record<string, unknown>).bookings)) {
    rawList = (root.data as Record<string, unknown>).bookings;
  } else if (Array.isArray(root.bookings)) {
    rawList = root.bookings;
  }

  const bookings: CalBookingResult[] = Array.isArray(rawList)
    ? rawList.map((entry) => unwrapBookingPayload({ data: entry }))
    : [];

  return { bookings };
}

export async function cancelCalBooking(
  uid: string,
  reason: string,
  opts: CalClientOptions,
): Promise<void> {
  await fetchJson(
    `${CAL_BASE_URL}/bookings/${encodeURIComponent(uid)}/cancel`,
    {
      method: "POST",
      headers: buildHeaders(opts),
      body: JSON.stringify({ cancellationReason: reason }),
    },
    opts,
  );
}
