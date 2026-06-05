import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { sanitizeError } from "./sanitize-error.ts";

Deno.test("sanitizeError - Error instance: returns stable code + message; never the stack", () => {
  const err = new Error("ENOTFOUND practitioner xyz: connection refused at db.example.com");
  const out = sanitizeError(err, { code: "downstream_failure" });
  assertEquals(out.code, "downstream_failure");
  // The message we ship is generic — the raw error string never appears.
  assertEquals(out.message, "An internal error occurred. Please contact support.");
  // The Error.stack must not leak via this helper, even though Error.stack
  // is present on the instance.
  assertNotEquals(
    JSON.stringify(out),
    JSON.stringify({ code: "downstream_failure", message: err.message }),
  );
});

Deno.test("sanitizeError - string error: still returns the safe message, not the string", () => {
  const out = sanitizeError("PGRST116 row not found", { code: "db_error" });
  assertEquals(out.code, "db_error");
  assertEquals(out.message, "An internal error occurred. Please contact support.");
});

Deno.test("sanitizeError - null / undefined error: still returns code + safe message", () => {
  const out = sanitizeError(null, { code: "unknown" });
  assertEquals(out.code, "unknown");
  assertEquals(out.message, "An internal error occurred. Please contact support.");
});

Deno.test("sanitizeError - default code is 'internal_error' when not provided", () => {
  const out = sanitizeError(new Error("anything"));
  assertEquals(out.code, "internal_error");
});

Deno.test("sanitizeError - custom client message can be supplied", () => {
  const out = sanitizeError(new Error("anything"), {
    code: "invalid_request",
    clientMessage: "The supplied appointment_time could not be parsed.",
  });
  assertEquals(out.code, "invalid_request");
  assertEquals(out.message, "The supplied appointment_time could not be parsed.");
});

Deno.test("sanitizeError - output shape is exactly {code, message} — no stack/cause/details", () => {
  const err = new Error("anything");
  // deno-lint-ignore no-explicit-any
  (err as any).cause = new Error("nested");
  const out = sanitizeError(err, { code: "test" });
  assertEquals(Object.keys(out).sort(), ["code", "message"]);
});

Deno.test("sanitizeError - includes Bland.ai signature mismatch path: maps to 'unauthorized' generically", () => {
  // Some callers want to keep the code stable for log correlation while
  // still emitting a generic message. The helper doesn't care WHAT code
  // you pass, only that you don't accidentally leak the raw error.
  const out = sanitizeError(new Error("signature_mismatch: 0x4f...0x88"), {
    code: "unauthorized",
  });
  assertEquals(out.code, "unauthorized");
  assertEquals(out.message, "An internal error occurred. Please contact support.");
});
