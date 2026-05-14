import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { signPayload, verifyRequestAuth } from "./auth-gate.ts";

// The auth gate is fail-closed: ANY missing/invalid signal must yield ok=false.
// Bland delivers webhooks anonymously (verify_jwt=false in config.toml) so this
// gate is the only thing between the public internet and our DB writes.

Deno.test("verifyRequestAuth rejects when secret is empty (fail-closed)", async () => {
  const body = '{"call_id":"abc"}';
  const result = await verifyRequestAuth("", "anything", body);
  assertEquals(result.ok, false);
  assertEquals(result.reason, "secret_not_configured");
});

Deno.test("verifyRequestAuth rejects when secret is undefined (fail-closed)", async () => {
  const body = '{"call_id":"abc"}';
  const result = await verifyRequestAuth(undefined, "anything", body);
  assertEquals(result.ok, false);
  assertEquals(result.reason, "secret_not_configured");
});

Deno.test("verifyRequestAuth rejects when signature header is missing", async () => {
  const body = '{"call_id":"abc"}';
  const result = await verifyRequestAuth("test-secret", null, body);
  assertEquals(result.ok, false);
  assertEquals(result.reason, "signature_missing");
});

Deno.test("verifyRequestAuth rejects when signature header is empty string", async () => {
  const body = '{"call_id":"abc"}';
  const result = await verifyRequestAuth("test-secret", "", body);
  assertEquals(result.ok, false);
  assertEquals(result.reason, "signature_missing");
});

Deno.test("verifyRequestAuth rejects when signature is invalid", async () => {
  const body = '{"call_id":"abc"}';
  const result = await verifyRequestAuth(
    "test-secret",
    "0000000000000000000000000000000000000000000000000000000000000000",
    body,
  );
  assertEquals(result.ok, false);
  assertEquals(result.reason, "signature_mismatch");
});

Deno.test("verifyRequestAuth rejects when signature length differs", async () => {
  const body = '{"call_id":"abc"}';
  const result = await verifyRequestAuth("test-secret", "deadbeef", body);
  assertEquals(result.ok, false);
  assertEquals(result.reason, "signature_mismatch");
});

Deno.test("verifyRequestAuth accepts a valid signature", async () => {
  const body = '{"call_id":"abc","status":"completed"}';
  const secret = "test-secret";
  const validSignature = await signPayload(secret, body);

  const result = await verifyRequestAuth(secret, validSignature, body);
  assertEquals(result.ok, true);
  assertEquals(result.reason, undefined);
});

Deno.test("verifyRequestAuth rejects when body is tampered with after signing", async () => {
  const originalBody = '{"call_id":"abc"}';
  const secret = "test-secret";
  const signature = await signPayload(secret, originalBody);

  const tamperedBody = '{"call_id":"abc","injected":true}';
  const result = await verifyRequestAuth(secret, signature, tamperedBody);
  assertEquals(result.ok, false);
  assertEquals(result.reason, "signature_mismatch");
});
