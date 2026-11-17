import assert from "node:assert/strict";
import test from "node:test";
import { isTrackingCode } from "../lib/order-tracking.ts";
import { formatOrderNumber, parseOrderNumber, statusLabel } from "../components/order-tracker.tsx";

test("accepts a displayed order number or digits and rejects invalid ids", () => {
  assert.equal(parseOrderNumber("#ORD-003"), 3);
  assert.equal(parseOrderNumber("ord-003"), 3);
  assert.equal(parseOrderNumber(" 3 "), 3);
  assert.equal(parseOrderNumber("#ORD-1000"), 1000);
  assert.equal(parseOrderNumber("#ORD-000"), null);
  assert.equal(parseOrderNumber("#ORD-4294967296"), null);
  assert.equal(parseOrderNumber("#ORD-1abc"), null);
  assert.equal(parseOrderNumber(null), null);
});

test("formats order numbers consistently without truncating large ids", () => {
  assert.equal(formatOrderNumber(1), "#ORD-001");
  assert.equal(formatOrderNumber(12), "#ORD-012");
  assert.equal(formatOrderNumber(1000), "#ORD-1000");
});

test("accepts only an exact 12-character tracking code", () => {
  assert.equal(isTrackingCode("aB3dE5gH7jK9"), true);
  assert.equal(isTrackingCode("short"), false);
  assert.equal(isTrackingCode("aB3dE5gH7jK!"), false);
  assert.equal(isTrackingCode(" aB3dE5gH7jK9"), false);
  assert.equal(isTrackingCode(null), false);
});

test("gives each supported order status a customer-facing label", () => {
  assert.equal(statusLabel("pending"), "รอดำเนินการ");
  assert.equal(statusLabel("preparing"), "กำลังเตรียมอาหาร");
  assert.equal(statusLabel("ready"), "พร้อมรับอาหาร");
  assert.equal(statusLabel("completed"), "รับอาหารแล้ว");
});
