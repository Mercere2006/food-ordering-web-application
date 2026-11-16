"use client";

import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { createOrder } from "@/app/actions/order";
import { cartTotal, formatPrice, MAX_QUANTITY, sameCart, type CartItem } from "@/lib/cart";
import { changeFoodQuantity, clearCart, clearSubmittedCart, getCurrentCart, removeFood, setCheckoutPending, useCart, useCheckoutPending } from "@/lib/cart-store";
import { validateOrderInput, type OrderInput } from "@/lib/order";
import { saveOrderReceipt } from "@/lib/order-receipt-store";
import { OrderTracker } from "@/components/order-tracker";

type Attempt = { fingerprint: string; trackCode: string };
const ATTEMPT_KEY = "food-ordering-pending-order-v1";

function fingerprintFor(customerName: string, items: CartItem[]) {
  return JSON.stringify({ customerName: customerName.trim(), items: items.map(({ id, quantity, priceSatang }) => ({ id, quantity, priceSatang })).sort((a, b) => a.id - b.id) });
}

function createTrackCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join("")).replace(/\+/g, "-").replace(/\//g, "_");
}

function readAttempt(): Attempt | null {
  const raw = localStorage.getItem(ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (saved && typeof saved === "object" && "fingerprint" in saved && typeof saved.fingerprint === "string" && "trackCode" in saved && typeof saved.trackCode === "string" && /^[A-Za-z0-9_-]{12}$/.test(saved.trackCode)) return { fingerprint: saved.fingerprint, trackCode: saved.trackCode };
  } catch { /* Discard invalid data rather than reusing an unknown code. */ }
  localStorage.removeItem(ATTEMPT_KEY);
  return null;
}

function newAttempt(fingerprint: string): Attempt {
  const attempt = { fingerprint, trackCode: createTrackCode() };
  localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
  return attempt;
}

function inputFromAttempt(attempt: Attempt): OrderInput | null {
  try {
    const data: unknown = JSON.parse(attempt.fingerprint);
    if (!data || typeof data !== "object") return null;
    const validated = validateOrderInput({ ...data, trackCode: attempt.trackCode });
    return validated.ok ? validated.value : null;
  } catch { return null; }
}

function forgetAttempt() {
  try { localStorage.removeItem(ATTEMPT_KEY); } catch { /* Keep the code if storage is temporarily unavailable. */ }
}

export function CartPanel() {
  const items = useCart();
  const pending = useCheckoutPending();
  const [customerName, setCustomerName] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [unresolvedAttempt, setUnresolvedAttempt] = useState<Attempt | null>(null);
  const submittingRef = useRef(false);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  async function sendOrder(input: OrderInput, submittedItems: CartItem[] | null) {
    setFeedback(null);
    try {
      const result = await createOrder(input);
      if (!result.ok) {
        if (!result.retryable) { setUnresolvedAttempt(null); forgetAttempt(); }
        setFeedback({ kind: "error", message: result.retryable ? "ยังยืนยันผลไม่ได้ กรุณาลองส่งคำสั่งซื้อเดิมอีกครั้ง" : result.message });
        return;
      }
      saveOrderReceipt({ orderNumber: result.orderNumber, trackCode: result.trackCode });
      const cleared = submittedItems !== null && clearSubmittedCart(submittedItems);
      setUnresolvedAttempt(null);
      forgetAttempt();
      setCustomerName("");
      setFeedback({ kind: "success", message: cleared ? "ส่งคำสั่งซื้อเรียบร้อยแล้ว" : "ส่งคำสั่งซื้อแล้ว แต่ตะกร้ามีการเปลี่ยนแปลง กรุณาตรวจสอบก่อนสั่งอีกครั้ง" });
    } catch {
      setFeedback({ kind: "error", message: "ยังยืนยันคำสั่งซื้อไม่ได้ กรุณาลองอีกครั้ง" });
    }
  }

  async function withCheckoutLock(action: () => Promise<void>) {
    if (submittingRef.current) return;
    if (!navigator.locks) { setFeedback({ kind: "error", message: "ไม่สามารถป้องกันการสั่งซื้อซ้ำได้ กรุณาเปิดเว็บผ่าน HTTPS หรือ localhost ด้วยเบราว์เซอร์รุ่นใหม่" }); return; }
    submittingRef.current = true;
    setCheckoutPending(true);
    try {
      await navigator.locks.request("food-ordering-checkout-v1", { ifAvailable: true }, async (lock) => {
        if (!lock) { setFeedback({ kind: "error", message: "กำลังส่งคำสั่งซื้อจากอีกแท็บ กรุณารอสักครู่" }); return; }
        await action();
      });
    } catch {
      setFeedback({ kind: "error", message: "ยังเตรียมคำสั่งซื้อไม่ได้ กรุณาตรวจสอบการตั้งค่าพื้นที่เก็บข้อมูลของเบราว์เซอร์" });
    } finally {
      setCheckoutPending(false);
      submittingRef.current = false;
    }
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !items.length || !customerName.trim()) return;
    void withCheckoutLock(async () => {
      if (!sameCart(getCurrentCart(), items)) { setFeedback({ kind: "error", message: "ตะกร้ามีการเปลี่ยนแปลง กรุณาตรวจสอบรายการก่อนสั่งซื้อ" }); return; }
      const fingerprint = fingerprintFor(customerName, items);
      let attempt = readAttempt();
      if (attempt && !inputFromAttempt(attempt)) { forgetAttempt(); attempt = null; }
      if (attempt && attempt.fingerprint !== fingerprint) {
        setUnresolvedAttempt(attempt);
        setFeedback({ kind: "error", message: "ยังไม่ทราบผลคำสั่งซื้อก่อนหน้า กรุณาลองส่งคำสั่งซื้อเดิมอีกครั้งก่อน" });
        return;
      }
      attempt = attempt ?? newAttempt(fingerprint);
      const input = inputFromAttempt(attempt);
      if (!input) { setFeedback({ kind: "error", message: "ข้อมูลคำสั่งซื้อไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" }); return; }
      await sendOrder(input, items);
    });
  }

  function retryPreviousOrder() {
    if (!unresolvedAttempt) return;
    void withCheckoutLock(async () => {
      const current = readAttempt();
      if (!current || current.trackCode !== unresolvedAttempt.trackCode || current.fingerprint !== unresolvedAttempt.fingerprint) { setUnresolvedAttempt(null); setFeedback({ kind: "error", message: "คำสั่งซื้อก่อนหน้าได้รับการจัดการจากอีกแท็บแล้ว กรุณาตรวจสอบออเดอร์ล่าสุด" }); return; }
      const input = inputFromAttempt(current);
      if (!input) { setFeedback({ kind: "error", message: "ข้อมูลคำสั่งซื้อก่อนหน้าไม่ถูกต้อง" }); return; }
      const currentItems = getCurrentCart();
      const sameItems = fingerprintFor(customerName, currentItems) === current.fingerprint ? currentItems : null;
      await sendOrder(input, sameItems);
    });
  }

  return (
    <aside className="sidebar" aria-label="พื้นที่ตะกร้าและติดตามออเดอร์">
      <section className="side-panel" aria-labelledby="cart-heading">
        <div className="panel-title"><ShoppingBasket aria-hidden="true" size={20} /><h2 id="cart-heading">ตะกร้าของฉัน</h2><span className="cart-count" aria-label={`${count} ชิ้น`}>{count}</span>{items.length > 0 && <button className="clear-cart" onClick={clearCart} disabled={pending}>ล้างตะกร้า</button>}</div>
        {items.length === 0 ? (
          <div className="cart-empty"><ShoppingBasket aria-hidden="true" size={31} strokeWidth={1.5} /><strong>ยังไม่มีรายการในตะกร้า</strong><span>เลือกเมนูที่ชอบเพื่อเพิ่มลงตะกร้า</span></div>
        ) : (
          <ul className="cart-items" aria-label="รายการในตะกร้า">
            {items.map((item) => (
              <li className="cart-item" key={item.id}>
                <div className="cart-item-info"><strong>{item.name}</strong><span>{formatPrice(item.priceSatang)} ฿ × {item.quantity} = <b className="cart-item-total">{formatPrice(item.priceSatang * item.quantity)} ฿</b></span></div>
                <div className="quantity-control"><button onClick={() => changeFoodQuantity(item.id, -1)} disabled={pending} aria-label={`ลดจำนวน ${item.name}`}><Minus size={14} aria-hidden="true" /></button><span aria-label={`${item.quantity} ชิ้น`}>{item.quantity}</span><button onClick={() => changeFoodQuantity(item.id, 1)} disabled={pending || item.quantity >= MAX_QUANTITY} aria-label={`เพิ่มจำนวน ${item.name}`}><Plus size={14} aria-hidden="true" /></button></div>
                <button className="remove-button" onClick={() => removeFood(item.id)} disabled={pending} aria-label={`ลบ ${item.name} ออกจากตะกร้า`}><Trash2 size={16} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submitOrder}>
          <div className="cart-fields"><label htmlFor="customer-name">ชื่อของคุณ (สำหรับรับอาหาร) <span className="required-mark">*</span></label><input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="เช่น คุณสมชาย" maxLength={60} autoComplete="name" required disabled={pending} /></div>
          <div className="cart-total"><span>ราคารวมทั้งหมด:</span><strong aria-live="polite">{formatPrice(cartTotal(items))} ฿</strong></div>
          <button className="checkout-button" type="submit" disabled={pending || items.length === 0 || !customerName.trim()}>{pending ? "กำลังส่งคำสั่งซื้อ…" : "ยืนยันคำสั่งซื้อ"}</button>
          <p className="checkout-note">{items.length === 0 ? "กรุณาเลือกอาหารเพิ่มลงตะกร้า" : !customerName.trim() ? "กรุณากรอกชื่อก่อนสั่งซื้อ" : "ตรวจสอบรายการและชื่อก่อนยืนยัน"}</p>
        </form>
        {feedback && <p className={`checkout-feedback ${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p>}
        {unresolvedAttempt && <button className="retry-order" type="button" disabled={pending} onClick={retryPreviousOrder}>ลองส่งคำสั่งซื้อเดิมอีกครั้ง</button>}
      </section>
      <OrderTracker />
    </aside>
  );
}
