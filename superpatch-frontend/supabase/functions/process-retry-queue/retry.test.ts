import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { incrementRetry, IncrementRetryError, shouldProcessManualTrigger } from "./retry.ts";

Deno.test("shouldProcessManualTrigger blocks outside business hours without force", () => {
  assertEquals(shouldProcessManualTrigger(undefined, false), false);
  assertEquals(shouldProcessManualTrigger(false, false), false);
});

Deno.test("shouldProcessManualTrigger allows within business hours", () => {
  assertEquals(shouldProcessManualTrigger(undefined, true), true);
});

Deno.test("shouldProcessManualTrigger force overrides business hours", () => {
  assertEquals(shouldProcessManualTrigger(true, false), true);
  assertEquals(shouldProcessManualTrigger(true, true), true);
});

Deno.test("incrementRetry calls increment_retry_count with the p_id argument", async () => {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve({ data: 2, error: null });
    },
  };

  const result = await incrementRetry(client, "practitioner-uuid");

  assertEquals(result, 2);
  assertEquals(calls, [
    { fn: "increment_retry_count", args: { p_id: "practitioner-uuid" } },
  ]);
});

Deno.test("incrementRetry throws IncrementRetryError when the RPC returns an error", async () => {
  const client = {
    rpc(_fn: string, _args: Record<string, unknown>) {
      return Promise.resolve({ data: null, error: { code: "PGRST202", message: "fn not found" } });
    },
  };

  await assertRejects(
    () => incrementRetry(client, "p"),
    IncrementRetryError,
    "increment_retry_count RPC failed",
  );
});

Deno.test("incrementRetry throws when the RPC returns no data", async () => {
  const client = {
    rpc(_fn: string, _args: Record<string, unknown>) {
      return Promise.resolve({ data: null, error: null });
    },
  };

  await assertRejects(
    () => incrementRetry(client, "p"),
    IncrementRetryError,
    "returned no value",
  );
});
