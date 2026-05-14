import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { dispatchEdgeFunction } from "./dispatch.ts";

// dispatchEdgeFunction MUST:
//   - return { ok: true } only when HTTP status is 2xx
//   - return { ok: false, reason } for non-2xx, network errors, or timeouts
//   - never throw — every failure mode is reported via the structured result

Deno.test("dispatchEdgeFunction returns ok on 200", async () => {
  const fakeFetch = () =>
    Promise.resolve(new Response('{"success":true}', { status: 200 }));

  const result = await dispatchEdgeFunction({
    url: "https://example.test/fn",
    bearer: "secret",
    body: { foo: 1 },
    label: "test-fn",
    fetchImpl: fakeFetch,
  });

  assertEquals(result.ok, true);
});

Deno.test("dispatchEdgeFunction returns ok=false on 500 with status detail", async () => {
  const fakeFetch = () =>
    Promise.resolve(new Response('{"error":"db_down"}', { status: 500 }));

  const result = await dispatchEdgeFunction({
    url: "https://example.test/fn",
    bearer: "secret",
    body: { foo: 1 },
    label: "test-fn",
    fetchImpl: fakeFetch,
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 500);
    // The reason should embed the upstream body so ops can see WHY it failed
    // when reading webhook-processor logs.
    assertEquals(result.reason.includes("500"), true);
    assertEquals(result.reason.includes("db_down"), true);
  }
});

Deno.test("dispatchEdgeFunction returns ok=false on 4xx", async () => {
  const fakeFetch = () =>
    Promise.resolve(new Response('{"error":"bad input"}', { status: 400 }));

  const result = await dispatchEdgeFunction({
    url: "https://example.test/fn",
    bearer: "secret",
    body: { foo: 1 },
    label: "test-fn",
    fetchImpl: fakeFetch,
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.httpStatus, 400);
  }
});

Deno.test("dispatchEdgeFunction returns ok=false on network error (never throws)", async () => {
  const fakeFetch = () => Promise.reject(new Error("connection refused"));

  const result = await dispatchEdgeFunction({
    url: "https://example.test/fn",
    bearer: "secret",
    body: { foo: 1 },
    label: "test-fn",
    fetchImpl: fakeFetch,
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.reason.includes("connection refused"), true);
  }
});

Deno.test("dispatchEdgeFunction truncates very long upstream error bodies", async () => {
  const longBody = "x".repeat(5000);
  const fakeFetch = () =>
    Promise.resolve(new Response(longBody, { status: 500 }));

  const result = await dispatchEdgeFunction({
    url: "https://example.test/fn",
    bearer: "secret",
    body: { foo: 1 },
    label: "test-fn",
    fetchImpl: fakeFetch,
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    // Capped to keep webhook-processor log lines bounded.
    assertEquals(result.reason.length <= 400, true);
  }
});

Deno.test("dispatchEdgeFunction sends bearer token and JSON body", async () => {
  let capturedInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = (
    _url: string | URL | Request,
    init?: RequestInit,
  ) => {
    capturedInit = init;
    return Promise.resolve(new Response("{}", { status: 200 }));
  };

  await dispatchEdgeFunction({
    url: "https://example.test/fn",
    bearer: "super-secret",
    body: { hello: "world" },
    label: "test-fn",
    fetchImpl: fakeFetch,
  });

  const headers = new Headers(capturedInit?.headers);
  assertEquals(headers.get("Authorization"), "Bearer super-secret");
  assertEquals(headers.get("Content-Type"), "application/json");
  assertEquals(capturedInit?.body, JSON.stringify({ hello: "world" }));
});
