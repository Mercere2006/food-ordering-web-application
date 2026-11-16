import { MAX_QUANTITY } from "./cart";

export type OrderInputItem = { id: number; quantity: number; priceSatang: number };
export type OrderInput = { customerName: string; trackCode: string; items: OrderInputItem[] };
export type OrderFood = { id: number; name: string; priceSatang: number; isAvailable: boolean };
export type PreparedOrderItem = { foodId: number; foodName: string; priceSatang: number; quantity: number };
type Failure = { ok: false; message: string };

const MAX_TOTAL_SATANG = 9_999_999_999;

export function validateOrderInput(input: unknown): { ok: true; value: OrderInput } | Failure {
  if (!input || typeof input !== "object") return { ok: false, message: "ข้อมูลคำสั่งซื้อไม่ถูกต้อง" };
  const { customerName, trackCode, items } = input as Record<string, unknown>;
  if (typeof customerName !== "string" || !customerName.trim() || Array.from(customerName.trim()).length > 60 || /[\u0000-\u001f\u007f]/.test(customerName)) return { ok: false, message: "กรุณากรอกชื่อไม่เกิน 60 ตัวอักษร" };
  if (typeof trackCode !== "string" || !/^[A-Za-z0-9_-]{12}$/.test(trackCode)) return { ok: false, message: "รหัสคำสั่งซื้อไม่ถูกต้อง กรุณาลองอีกครั้ง" };
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return { ok: false, message: "กรุณาเลือกอาหารในตะกร้า" };
  const seen = new Set<number>();
  const validated: OrderInputItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return { ok: false, message: "รายการอาหารไม่ถูกต้อง" };
    const { id, quantity, priceSatang } = item as Record<string, unknown>;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 4_294_967_295 || seen.has(id) || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || typeof priceSatang !== "number" || !Number.isSafeInteger(priceSatang) || priceSatang < 0 || priceSatang > MAX_TOTAL_SATANG) return { ok: false, message: "รายการอาหารหรือจำนวนไม่ถูกต้อง" };
    seen.add(id);
    validated.push({ id, quantity, priceSatang });
  }
  return { ok: true, value: { customerName: customerName.trim(), trackCode, items: validated } };
}

export function prepareOrderItems(items: OrderInputItem[], foods: OrderFood[]): { ok: true; items: PreparedOrderItem[]; totalSatang: number } | Failure {
  const byId = new Map(foods.map((food) => [food.id, food]));
  const prepared: PreparedOrderItem[] = [];
  let totalSatang = 0;
  for (const item of items) {
    const food = byId.get(item.id);
    if (!food || !food.isAvailable) return { ok: false, message: "บางเมนูไม่พร้อมขายแล้ว กรุณารีเฟรชหน้า ล้างตะกร้า และเลือกเมนูอีกครั้ง" };
    if (food.priceSatang !== item.priceSatang) return { ok: false, message: "ราคาบางเมนูเปลี่ยนแล้ว กรุณารีเฟรชหน้า ล้างตะกร้า และเลือกเมนูอีกครั้ง" };
    totalSatang += food.priceSatang * item.quantity;
    if (totalSatang > MAX_TOTAL_SATANG) return { ok: false, message: "ยอดรวมเกินจำนวนที่ระบบรองรับ กรุณาลดจำนวนอาหาร" };
    prepared.push({ foodId: food.id, foodName: food.name, priceSatang: food.priceSatang, quantity: item.quantity });
  }
  return { ok: true, items: prepared, totalSatang };
}

export function matchesOrderInput(saved: { customerName: string; items: Array<{ foodId: number; quantity: number; priceSatang: number }> }, input: OrderInput): boolean {
  if (saved.customerName !== input.customerName || saved.items.length !== input.items.length) return false;
  const requested = new Map(input.items.map((item) => [item.id, item]));
  const seen = new Set<number>();
  return saved.items.every((item) => {
    const expected = requested.get(item.foodId);
    if (seen.has(item.foodId) || !expected) return false;
    seen.add(item.foodId);
    return expected.quantity === item.quantity && expected.priceSatang === item.priceSatang;
  });
}
