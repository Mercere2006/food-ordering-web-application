"use client";

import { useSyncExternalStore } from "react";

export type OrderReceipt = { orderNumber: number; trackCode: string };
const KEY = "food-ordering-last-order-v1";
const listeners = new Set<() => void>();
let cachedValue: string | null | undefined;
let cachedReceipt: OrderReceipt | null = null;
let memoryOnly = false;

function getSnapshot(): OrderReceipt | null {
  if (memoryOnly) return cachedReceipt;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== cachedValue) {
      cachedValue = raw;
      cachedReceipt = null;
      if (raw) {
        try {
          const value: unknown = JSON.parse(raw);
          if (value && typeof value === "object" && "orderNumber" in value && typeof value.orderNumber === "number" && Number.isSafeInteger(value.orderNumber) && value.orderNumber > 0 && "trackCode" in value && typeof value.trackCode === "string" && /^[A-Za-z0-9_-]{12}$/.test(value.trackCode)) {
            cachedReceipt = { orderNumber: value.orderNumber, trackCode: value.trackCode };
          }
        } catch { /* Ignore invalid saved data. */ }
      }
    }
  } catch {
    memoryOnly = true;
  }
  return cachedReceipt;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) onChange(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(onChange); window.removeEventListener("storage", onStorage); };
}

export function useOrderReceipt() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function saveOrderReceipt(receipt: OrderReceipt) {
  cachedReceipt = receipt;
  cachedValue = JSON.stringify(receipt);
  if (!memoryOnly) {
    try { window.localStorage.setItem(KEY, cachedValue); } catch { memoryOnly = true; }
  }
  listeners.forEach((notify) => notify());
}
