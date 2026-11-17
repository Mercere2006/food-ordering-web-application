"use client";

import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createOrder } from "@/app/actions/order";
import { cartTotal, formatPrice, MAX_QUANTITY, sameCart, type CartItem } from "@/lib/cart";
import { changeFoodQuantity, clearCart, clearSubmittedCart, getCurrentCart, removeFood, setCheckoutPending, useCart, useCheckoutPending } from "@/lib/cart-store";
import { validateOrderInput, type OrderInput } from "@/lib/order";
import { saveOrderReceipt } from "@/components/order-tracker";

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
  const router = useRouter();
  const items = useCart();
  const pending = useCheckoutPending();
  const [customerName, setCustomerName] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [unresolvedAttempt, setUnresolvedAttempt] = useState<Attempt | null>(null);
  const [cartVisible, setCartVisible] = useState(false);
  const cartRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const cart = cartRef.current;
    if (!cart || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setCartVisible(entry.isIntersecting));
    observer.observe(cart);
    return () => observer.disconnect();
  }, []);

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
      router.push(cleared ? "/tracking" : "/tracking?cart=changed");
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
    <aside className="sticky top-4 grid max-h-[calc(100dvh-32px)] gap-6 overflow-y-auto overscroll-contain max-[700px]:static max-[700px]:grid-cols-1 max-[700px]:max-h-none max-[700px]:overflow-visible" aria-label="ตะกร้าของฉัน">
      <section id="cart" ref={cartRef} className="scroll-mt-5 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_#15223a0d]" aria-labelledby="cart-heading">
        <div className="flex items-center gap-2 border-b border-[#edf1f5] pb-[15px] [&_svg]:shrink-0 [&_svg]:text-[#8294ab] [&_h2]:m-0 [&_h2]:text-[15px] [&_h2]:font-extrabold"><ShoppingBasket aria-hidden="true" size={20} /><h2 id="cart-heading">ตะกร้าของฉัน</h2><span className="grid h-5 min-w-[23px] place-items-center rounded-[10px] bg-[var(--accent)] text-[11px] font-extrabold text-white" aria-label={`${count} ชิ้น`} aria-live="polite">{count}</span>{items.length > 0 && <button className="ml-auto cursor-pointer border-0 bg-transparent py-1.5 pl-2 text-[11px] font-bold text-[#7c8da4] hover:text-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-50" onClick={clearCart} disabled={pending}>ล้างตะกร้า</button>}</div>
        {items.length === 0 ? (
          <div className="mt-4 flex min-h-[156px] flex-col items-center justify-center gap-[7px] rounded-[17px] border-2 border-dashed border-[#edf2f8] p-4 text-center text-[#98a9bf] [&_strong]:text-[13px] [&_strong]:text-[#71839c] [&_span]:text-[11px] [&_span]:leading-normal"><ShoppingBasket aria-hidden="true" size={31} strokeWidth={1.5} /><strong>ยังไม่มีรายการในตะกร้า</strong><span>เลือกเมนูที่ชอบเพื่อเพิ่มลงตะกร้า</span></div>
        ) : (
          <ul className="mt-4 grid list-none gap-2 p-0" aria-label="รายการในตะกร้า">
            {items.map((item) => (
              <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-[15px] border border-[#edf1f5] bg-[#f7f9fc] p-3" key={item.id}>
                <div className="flex min-w-0 flex-col gap-[3px] [&_strong]:text-[13px] [&_strong]:leading-normal [&_strong]:break-all [&_span]:text-[11px] [&_span]:text-[var(--muted)]"><strong>{item.name}</strong><span>{formatPrice(item.priceSatang)} ฿ × {item.quantity} = <b className="text-[11px] text-[var(--accent)]">{formatPrice(item.priceSatang * item.quantity)} ฿</b></span></div>
                <div className="flex items-center rounded-[11px] border border-[#e2e9f1] bg-white [&_button]:grid [&_button]:h-[29px] [&_button]:w-[27px] [&_button]:cursor-pointer [&_button]:place-items-center [&_button]:rounded-[9px] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[var(--accent-dark)] [&_button:hover:not(:disabled)]:bg-[#e1f2ff] [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50 [&_span]:min-w-[18px] [&_span]:text-center [&_span]:text-[13px] [&_span]:font-bold"><button onClick={() => changeFoodQuantity(item.id, -1)} disabled={pending} aria-label={`ลดจำนวน ${item.name}`}><Minus size={14} aria-hidden="true" /></button><span aria-label={`${item.quantity} ชิ้น`}>{item.quantity}</span><button onClick={() => changeFoodQuantity(item.id, 1)} disabled={pending || item.quantity >= MAX_QUANTITY} aria-label={`เพิ่มจำนวน ${item.name}`}><Plus size={14} aria-hidden="true" /></button></div>
                <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-0 bg-transparent text-[#8798ae] hover:bg-[#fff2f2] hover:text-[#b63e43] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => removeFood(item.id)} disabled={pending} aria-label={`ลบ ${item.name} ออกจากตะกร้า`}><Trash2 size={16} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submitOrder}>
          <div className="mt-4 border-y border-[#edf1f5] pt-[14px] pb-4 [&_label]:mb-[7px] [&_label]:block [&_label]:text-[11px] [&_label]:font-bold [&_label]:text-[#586c87] [&_input]:min-h-[42px] [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[var(--border)] [&_input]:bg-white [&_input]:px-[13px] [&_input]:py-2.5 [&_input]:text-xs [&_input]:text-[#8292a8] [&_input:not(:disabled)]:text-[var(--text)] [&_input::placeholder]:text-[#a5b2c4]"><label htmlFor="customer-name">ชื่อของคุณ (สำหรับรับอาหาร) <span className="text-[#b43434]">*</span></label><input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="เช่น คุณสมชาย" maxLength={60} autoComplete="name" required disabled={pending} /></div>
          <div className="mt-4 mb-3 flex items-center justify-between text-[13px] font-bold text-[#586c87] [&_strong]:text-lg [&_strong]:text-[var(--accent)]"><span>ราคารวมทั้งหมด:</span><strong aria-live="polite">{formatPrice(cartTotal(items))} ฿</strong></div>
          <button className="min-h-12 w-full cursor-pointer rounded-xl border-0 bg-[var(--accent)] text-sm font-extrabold text-white hover:not-disabled:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]" type="submit" disabled={pending || items.length === 0 || !customerName.trim()}>{pending ? "กำลังส่งคำสั่งซื้อ…" : "ยืนยันคำสั่งซื้อ"}</button>
          <p className="mt-2.5 text-center text-[11px] leading-normal text-[#8292a8]">{items.length === 0 ? "กรุณาเลือกอาหารเพิ่มลงตะกร้า" : !customerName.trim() ? "กรุณากรอกชื่อก่อนสั่งซื้อ" : "ตรวจสอบรายการและชื่อก่อนยืนยัน"}</p>
        </form>
        {feedback && <p className={`mt-3 rounded-[10px] px-3 py-2.5 text-xs leading-relaxed ${feedback.kind === "error" ? "bg-[#fff0f0] text-[#a32f2f]" : "bg-[#e9f8ef] text-[#206349]"}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p>}
        {unresolvedAttempt && <button className="mt-2 w-full cursor-pointer rounded-[10px] border border-[#c8deee] bg-[#f2f9ff] px-3 py-2.5 text-xs font-bold text-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={pending} onClick={retryPreviousOrder}>ลองส่งคำสั่งซื้อเดิมอีกครั้ง</button>}
      </section>
      {count > 0 && !cartVisible && <a className="hidden max-[700px]:fixed max-[700px]:right-4 max-[700px]:bottom-[max(16px,env(safe-area-inset-bottom))] max-[700px]:left-4 max-[700px]:z-20 max-[700px]:flex max-[700px]:min-h-14 max-[700px]:items-center max-[700px]:justify-between max-[700px]:gap-3 max-[700px]:rounded-2xl max-[700px]:bg-[var(--accent)] max-[700px]:px-[17px] max-[700px]:py-3 max-[700px]:text-[13px] max-[700px]:font-bold max-[700px]:text-white max-[700px]:shadow-[0_8px_25px_#124f8470] [&_span]:flex [&_span]:items-center [&_span]:gap-[9px] [&_b]:rounded-[10px] [&_b]:bg-[#ffffff2e] [&_b]:px-2 [&_b]:py-[3px] [&_b]:text-[11px] [&_strong]:text-[15px]" href="#cart"><span><ShoppingBasket size={19} aria-hidden="true" /> ดูตะกร้า <b aria-live="polite">{count} ชิ้น</b></span><strong>{formatPrice(cartTotal(items))} ฿</strong></a>}
    </aside>
  );
}
