"use client";

import { useSyncExternalStore } from "react";
import { addToCart, changeQuantity, parseStoredCart, removeFromCart, sameCart, type CartFood, type CartItem } from "./cart";

const STORAGE_KEY = "food-ordering-cart-v1";
const EMPTY_CART: CartItem[] = [];
const listeners = new Set<() => void>();
let cachedCart: CartItem[] = EMPTY_CART;
let cachedValue: string | null | undefined;
let memoryOnly = false;
let checkoutPending = false;

function getSnapshot(): CartItem[] {
  if (memoryOnly) return cachedCart;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value !== cachedValue) {
      cachedValue = value;
      cachedCart = parseStoredCart(value);
    }
  } catch {
    memoryOnly = true;
  }
  return cachedCart;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function save(items: CartItem[]) {
  const value = JSON.stringify({ version: 1, items });
  cachedCart = items;
  cachedValue = value;
  if (!memoryOnly) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      memoryOnly = true;
    }
  }
  listeners.forEach((notify) => notify());
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_CART);
}

export function useCheckoutPending(): boolean {
  return useSyncExternalStore(subscribe, () => checkoutPending, () => false);
}

export function setCheckoutPending(pending: boolean) {
  checkoutPending = pending;
  listeners.forEach((notify) => notify());
}

export function addFood(food: CartFood) { save(addToCart(getSnapshot(), food)); }
export function changeFoodQuantity(id: number, change: 1 | -1) { save(changeQuantity(getSnapshot(), id, change)); }
export function removeFood(id: number) { save(removeFromCart(getSnapshot(), id)); }
export function clearCart() { save([]); }
export function getCurrentCart(): CartItem[] { return getSnapshot(); }
export function clearSubmittedCart(submitted: CartItem[]): boolean {
  if (!sameCart(getSnapshot(), submitted)) return false;
  save([]);
  return true;
}
