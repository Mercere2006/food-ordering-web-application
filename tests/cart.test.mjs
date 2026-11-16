import assert from "node:assert/strict";
import test from "node:test";
import { addToCart, changeQuantity, removeFromCart, cartTotal, parseStoredCart, sameCart } from "../lib/cart.ts";

const basil = { id: 1, name: "ข้าวกะเพราไก่", priceSatang: 6500 };
const tea = { id: 18, name: "ชาเขียว", priceSatang: 4550 };

test("adding, changing quantities and removing items updates the exact total", () => {
  let cart = addToCart([], basil);
  cart = addToCart(cart, basil);
  cart = addToCart(cart, tea);
  assert.equal(cart[0].quantity, 2);
  assert.equal(cartTotal(cart), 17550);
  cart = changeQuantity(cart, 1, -1);
  assert.equal(cartTotal(cart), 11050);
  cart = removeFromCart(cart, 18);
  assert.deepEqual(cart.map((item) => item.id), [1]);
  cart = changeQuantity(cart, 1, -1);
  assert.deepEqual(cart, []);
});

test("bounds quantities and ignores malformed saved cart entries", () => {
  let cart = [{ ...basil, quantity: 99 }];
  cart = addToCart(cart, basil);
  assert.equal(cart[0].quantity, 99);
  assert.deepEqual(parseStoredCart("invalid JSON"), []);
  assert.deepEqual(parseStoredCart(JSON.stringify({ version: 1, items: [
    { ...basil, quantity: 2 }, { ...tea, quantity: -1 }, { ...basil, quantity: 1 },
  ] })), [{ ...basil, quantity: 2 }]);
});

test("detects changes made to the cart while an order is submitting", () => {
  const submitted = [{ ...basil, quantity: 1 }];
  assert.equal(sameCart(submitted, [{ ...basil, quantity: 1 }]), true);
  assert.equal(sameCart(submitted, [{ ...basil, quantity: 2 }]), false);
  assert.equal(sameCart(submitted, [{ ...basil, quantity: 1 }, { ...tea, quantity: 1 }]), false);
  assert.equal(sameCart(submitted, [{ ...basil, quantity: 1, priceSatang: 7000 }]), false);
});
