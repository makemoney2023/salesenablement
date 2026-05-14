import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decideIdempotency } from "./idempotency.ts";

Deno.test("decideIdempotency - no call_id -> proceed", () => {
  const decision = decideIdempotency({ call_id: undefined, existing: null });
  assertEquals(decision.skip, false);
  if (decision.skip === false) {
    assertEquals(decision.reason, "no_call_id");
  }
});

Deno.test("decideIdempotency - empty string call_id -> proceed", () => {
  const decision = decideIdempotency({ call_id: "", existing: null });
  assertEquals(decision.skip, false);
});

Deno.test("decideIdempotency - call_id but no existing row -> proceed (new call)", () => {
  const decision = decideIdempotency({ call_id: "call_abc", existing: null });
  assertEquals(decision.skip, false);
  if (decision.skip === false) {
    assertEquals(decision.reason, "no_existing_row");
  }
});

Deno.test("decideIdempotency - existing row with processed_at NULL -> proceed (first delivery in progress)", () => {
  const decision = decideIdempotency({
    call_id: "call_abc",
    existing: { id: "rec_1", processed_at: null },
  });
  assertEquals(decision.skip, false);
  if (decision.skip === false) {
    assertEquals(decision.reason, "not_yet_processed");
  }
});

Deno.test("decideIdempotency - existing row with processed_at SET -> SHORT-CIRCUIT (duplicate delivery)", () => {
  const processedAt = "2026-05-14T12:00:00.000Z";
  const decision = decideIdempotency({
    call_id: "call_abc",
    existing: { id: "rec_1", processed_at: processedAt },
  });
  assertEquals(decision.skip, true);
  if (decision.skip === true) {
    assertEquals(decision.reason, "already_processed");
    assertEquals(decision.recordId, "rec_1");
    assertEquals(decision.processedAt, processedAt);
  }
});

Deno.test("decideIdempotency - existing row missing id but processed_at set -> still short-circuits (recordId null)", () => {
  const decision = decideIdempotency({
    call_id: "call_abc",
    existing: { processed_at: "2026-05-14T12:00:00.000Z" },
  });
  assertEquals(decision.skip, true);
  if (decision.skip === true) {
    assertEquals(decision.recordId, null);
  }
});

Deno.test("decideIdempotency - existing row with empty-string processed_at -> proceed (treat empty as not processed)", () => {
  const decision = decideIdempotency({
    call_id: "call_abc",
    existing: { id: "rec_1", processed_at: "" },
  });
  assertEquals(decision.skip, false);
});
