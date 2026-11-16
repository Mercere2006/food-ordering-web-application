"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { matchesOrderInput, prepareOrderItems, validateOrderInput, type OrderInput } from "@/lib/order";

export type CreateOrderResult =
  | { ok: true; orderNumber: number; trackCode: string }
  | { ok: false; message: string; retryable: boolean };

async function findMatchingOrder(input: OrderInput) {
  const existing = await prisma.order.findUnique({ where: { trackCode: input.trackCode }, include: { items: true } });
  if (!existing) return null;
  const matches = existing.trackCode === input.trackCode && matchesOrderInput({ customerName: existing.customerName, items: existing.items.map((item) => ({ foodId: item.foodId, quantity: item.quantity, priceSatang: item.price.mul(100).toNumber() })) }, input);
  return matches
    ? { ok: true as const, orderNumber: existing.id, trackCode: existing.trackCode }
    : { ok: false as const, message: "รหัสคำสั่งซื้อนี้ถูกใช้งานแล้ว กรุณาลองใหม่", retryable: false };
}

export async function createOrder(rawInput: unknown): Promise<CreateOrderResult> {
  const parsed = validateOrderInput(rawInput);
  if (!parsed.ok) return { ...parsed, retryable: false };
  const input = parsed.value;

  try {
    const previous = await findMatchingOrder(input);
    if (previous) return previous;

    const result = await prisma.$transaction(async (tx) => {
      const ids = input.items.map((item) => item.id).sort((a, b) => a - b);
      const foods = await tx.$queryRaw<Array<{ id: number | bigint; name: string; price: Prisma.Decimal; isAvailable: number | boolean }>>`
        SELECT id, name, price, is_available AS isAvailable
        FROM food_013_tb WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
      `;
      const prepared = prepareOrderItems(input.items, foods.map((food) => ({
        ...food,
        id: Number(food.id),
        isAvailable: Boolean(food.isAvailable),
        priceSatang: food.price.mul(100).toNumber(),
      })));
      if (!prepared.ok) return { ...prepared, retryable: false };

      const now = new Date();
      const order = await tx.order.create({
        data: {
          trackCode: input.trackCode,
          customerName: input.customerName,
          total: (prepared.totalSatang / 100).toFixed(2),
          status: "pending",
          createdAt: now,
          updatedAt: now,
          items: { create: prepared.items.map((item) => ({
            foodId: item.foodId,
            foodName: item.foodName,
            price: (item.priceSatang / 100).toFixed(2),
            quantity: item.quantity,
          })) },
        },
        select: { id: true, trackCode: true },
      });
      return { ok: true as const, orderNumber: order.id, trackCode: order.trackCode };
    });
    if (!result.ok) {
      const previous = await findMatchingOrder(input);
      if (previous) return previous;
    }
    return result;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      try {
        const previous = await findMatchingOrder(input);
        if (previous) return previous;
      } catch {
        // Retrying with the same code is safe if the previous result is unknown.
      }
    }
    return { ok: false, message: "ยังยืนยันคำสั่งซื้อไม่ได้ กรุณาลองอีกครั้ง", retryable: true };
  }
}
