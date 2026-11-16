export type CartFood = { id: number; name: string; priceSatang: number };
export type CartItem = CartFood & { quantity: number };

export const MAX_QUANTITY = 99;

export function addToCart(items: CartItem[], food: CartFood): CartItem[] {
  const existing = items.find((item) => item.id === food.id);
  if (!existing) return [...items, { ...food, quantity: 1 }];
  return items.map((item) => item.id === food.id
    ? { ...food, quantity: Math.min(item.quantity + 1, MAX_QUANTITY) }
    : item);
}

export function changeQuantity(items: CartItem[], id: number, change: 1 | -1): CartItem[] {
  return items.flatMap((item) => {
    if (item.id !== id) return [item];
    const quantity = Math.min(item.quantity + change, MAX_QUANTITY);
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}

export function removeFromCart(items: CartItem[], id: number): CartItem[] {
  return items.filter((item) => item.id !== id);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.priceSatang * item.quantity, 0);
}

export function sameCart(first: CartItem[], second: CartItem[]): boolean {
  if (first.length !== second.length) return false;
  const byId = new Map(second.map((item) => [item.id, item]));
  return first.every((item) => {
    const other = byId.get(item.id);
    return other && other.name === item.name && other.quantity === item.quantity && other.priceSatang === item.priceSatang;
  });
}

export function parseStoredCart(value: string | null): CartItem[] {
  if (!value) return [];
  try {
    const stored: unknown = JSON.parse(value);
    if (!stored || typeof stored !== "object" || !("version" in stored) || stored.version !== 1 || !("items" in stored) || !Array.isArray(stored.items)) return [];
    const result: CartItem[] = [];
    const seen = new Set<number>();
    for (const item of stored.items) {
      if (!item || typeof item !== "object") continue;
      const { id, name, priceSatang, quantity } = item;
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id) || typeof name !== "string" || !name.trim() || name.length > 100 || !Number.isSafeInteger(priceSatang) || priceSatang < 0 || priceSatang > 9_999_999_999 || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) continue;
      result.push({ id, name, priceSatang, quantity });
      seen.add(id);
    }
    return result;
  } catch {
    return [];
  }
}

export function formatPrice(satang: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(satang / 100);
}
