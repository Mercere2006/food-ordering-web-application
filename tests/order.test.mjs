import assert from "node:assert/strict";
import test from "node:test";
import { validateOrderInput, prepareOrderItems, matchesOrderInput } from "../lib/order.ts";

const input = { customerName: "  สมชาย  ", trackCode: "aB3dE5gH7jK9", items: [{ id: 1, quantity: 2, priceSatang: 6500 }, { id: 2, quantity: 1, priceSatang: 7550 }] };
const foods = [{ id: 1, name: "ข้าวกะเพราไก่", priceSatang: 6500, isAvailable: true }, { id: 2, name: "ข้าวผัดกุ้ง", priceSatang: 7550, isAvailable: true }];

test("validates the customer, unique items and bounded quantities", () => {
  const valid = validateOrderInput(input);
  assert.equal(valid.ok, true);
  assert.equal(valid.value.customerName, "สมชาย");
  assert.equal(validateOrderInput({ ...input, customerName: "  " }).ok, false);
  assert.equal(validateOrderInput({ ...input, customerName: "ก".repeat(61) }).ok, false);
  assert.equal(validateOrderInput({ ...input, trackCode: "short" }).ok, false);
  assert.equal(validateOrderInput({ ...input, items: [] }).ok, false);
  assert.equal(validateOrderInput({ ...input, items: [input.items[0], input.items[0]] }).ok, false);
  assert.equal(validateOrderInput({ ...input, items: [{ ...input.items[0], quantity: 100 }] }).ok, false);
  assert.equal(validateOrderInput({ ...input, items: [{ ...input.items[0], priceSatang: -1 }] }).ok, false);
});

test("calculates totals from current database prices and rejects changed or unavailable food", () => {
  const result = prepareOrderItems(input.items, foods);
  assert.equal(result.ok, true);
  assert.equal(result.totalSatang, 20550);
  assert.deepEqual(result.items.map((item) => item.foodName), ["ข้าวกะเพราไก่", "ข้าวผัดกุ้ง"]);
  assert.equal(prepareOrderItems(input.items, foods.slice(0, 1)).ok, false);
  assert.equal(prepareOrderItems(input.items, [{ ...foods[0], isAvailable: false }, foods[1]]).ok, false);
  assert.equal(prepareOrderItems(input.items, [{ ...foods[0], priceSatang: 7000 }, foods[1]]).ok, false);
  assert.equal(prepareOrderItems([{ id: 1, quantity: 99, priceSatang: 9_999_999_999 }], [{ id: 1, name: "อาหาร", priceSatang: 9_999_999_999, isAvailable: true }]).ok, false);
});

test("only treats a retry as the same order when its customer and every item match", () => {
  const saved = { customerName: "สมชาย", items: [{ foodId: 1, quantity: 2, priceSatang: 6500 }, { foodId: 2, quantity: 1, priceSatang: 7550 }] };
  const valid = validateOrderInput(input);
  assert.equal(matchesOrderInput(saved, valid.value), true);
  assert.equal(matchesOrderInput({ ...saved, customerName: "สมหญิง" }, valid.value), false);
  assert.equal(matchesOrderInput({ ...saved, items: [saved.items[0], saved.items[0]] }, valid.value), false);
  assert.equal(matchesOrderInput({ ...saved, items: [{ ...saved.items[0], priceSatang: 5000 }, saved.items[1]] }, valid.value), false);
});
