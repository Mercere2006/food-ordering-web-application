"use client";

import { MAX_QUANTITY, type CartFood } from "@/lib/cart";
import { addFood, useCart, useCheckoutPending } from "@/lib/cart-store";

export function AddToCartButton({ food }: { food: CartFood }) {
  const items = useCart();
  const quantity = items.find((item) => item.id === food.id)?.quantity ?? 0;
  const atLimit = quantity >= MAX_QUANTITY;
  const pending = useCheckoutPending();
  return <button className={quantity > 0 ? "add-button is-selected" : "add-button"} onClick={() => addFood(food)} disabled={atLimit || pending} aria-label={atLimit ? `${food.name} ครบจำนวนสูงสุดแล้ว` : `เพิ่ม ${food.name} ลงตะกร้า`}>{atLimit ? "ครบจำนวนสูงสุด" : "+ เพิ่มลงตะกร้า"}</button>;
}
