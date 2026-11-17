"use client";

import { MAX_QUANTITY, type CartFood } from "@/lib/cart";
import { addFood, useCart, useCheckoutPending } from "@/lib/cart-store";

export function AddToCartButton({ food }: { food: CartFood }) {
  const items = useCart();
  const quantity = items.find((item) => item.id === food.id)?.quantity ?? 0;
  const atLimit = quantity >= MAX_QUANTITY;
  const pending = useCheckoutPending();
  return <button className={`min-h-[38px] cursor-pointer rounded-[13px] border border-[#ebd0bc] px-3.5 text-xs font-extrabold transition-all disabled:cursor-not-allowed ${quantity > 0 ? "border-[#8b261e] bg-[#8b261e] text-white hover:not-disabled:bg-[#731e17]" : "bg-[#fff8f2] text-[#8b261e] hover:not-disabled:border-[#8b261e] hover:not-disabled:bg-[#8b261e] hover:not-disabled:text-white"}`} onClick={() => addFood(food)} disabled={atLimit || pending} aria-label={atLimit ? `${food.name} ครบจำนวนสูงสุดแล้ว` : `เพิ่ม ${food.name} ลงตะกร้า`}>{atLimit ? "ครบจำนวนสูงสุด" : "+ เพิ่มลงตะกร้า"}</button>;
}
