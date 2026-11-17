"use client";

import { ArrowLeft, ArrowRight, Check, Clock3, RefreshCw, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { formatPrice } from "@/lib/cart";
import { isOrderNumber, type TrackedOrder, type TrackingStatus } from "@/lib/order-tracking";

export function formatOrderNumber(orderNumber: number): string {
  return `#ORD-${String(orderNumber).padStart(3, "0")}`;
}

export function parseOrderNumber(value: unknown): number | null {
  if (typeof value !== "string" || value.length > 32) return null;
  const match = /^(?:#?ORD-)?(\d{1,10})$/i.exec(value.trim());
  if (!match) return null;
  const orderNumber = Number(match[1]);
  return isOrderNumber(orderNumber) ? orderNumber : null;
}

const STATUS_LABELS: Record<TrackingStatus, string> = {
  pending: "รอดำเนินการ",
  preparing: "กำลังเตรียมอาหาร",
  ready: "พร้อมรับอาหาร",
  completed: "รับอาหารแล้ว",
};

export function statusLabel(status: TrackingStatus): string {
  return STATUS_LABELS[status];
}

// เก็บออเดอร์ล่าสุดไว้ในเบราว์เซอร์ เพื่อเปิดหน้านี้ได้ทันทีหลังสั่งซื้อ
type OrderReceipt = { orderNumber: number; trackCode: string };
const RECEIPT_KEY = "food-ordering-last-order-v1";
const receiptListeners = new Set<() => void>();
let cachedReceiptValue: string | null | undefined;
let cachedReceipt: OrderReceipt | null = null;
let receiptMemoryOnly = false;

function getReceipt(): OrderReceipt | null {
  if (receiptMemoryOnly) return cachedReceipt;
  try {
    const raw = window.localStorage.getItem(RECEIPT_KEY);
    if (raw !== cachedReceiptValue) {
      cachedReceiptValue = raw;
      cachedReceipt = null;
      if (raw) {
        try {
          const value: unknown = JSON.parse(raw);
          if (value && typeof value === "object" && "orderNumber" in value && typeof value.orderNumber === "number" && Number.isSafeInteger(value.orderNumber) && value.orderNumber > 0 && "trackCode" in value && typeof value.trackCode === "string" && /^[A-Za-z0-9_-]{12}$/.test(value.trackCode)) {
            cachedReceipt = { orderNumber: value.orderNumber, trackCode: value.trackCode };
          }
        } catch { /* ข้ามข้อมูลที่บันทึกไว้ไม่ถูกต้อง */ }
      }
    }
  } catch {
    receiptMemoryOnly = true;
  }
  return cachedReceipt;
}

function subscribeReceipt(onChange: () => void) {
  receiptListeners.add(onChange);
  const onStorage = (event: StorageEvent) => { if (event.key === RECEIPT_KEY || event.key === null) onChange(); };
  window.addEventListener("storage", onStorage);
  return () => { receiptListeners.delete(onChange); window.removeEventListener("storage", onStorage); };
}

function useOrderReceipt() {
  return useSyncExternalStore(subscribeReceipt, getReceipt, () => null);
}

export function saveOrderReceipt(receipt: OrderReceipt) {
  cachedReceipt = receipt;
  cachedReceiptValue = JSON.stringify(receipt);
  if (!receiptMemoryOnly) {
    try { window.localStorage.setItem(RECEIPT_KEY, cachedReceiptValue); } catch { receiptMemoryOnly = true; }
  }
  receiptListeners.forEach((notify) => notify());
}

type Selection = { orderNumber: number; receiptCode: string | null };
type TrackingView = { key: string; order: TrackedOrder | null; error: string | null };
const REFRESH_INTERVAL_MS = 30_000;
const isPageVisible = () => document.visibilityState !== "hidden";
const steps: { status: TrackingStatus; short: string; description: string }[] = [
  { status: "pending", short: "รับออเดอร์", description: "ร้านได้รับออเดอร์แล้ว รอสักครู่นะ" },
  { status: "preparing", short: "กำลังปรุง", description: "เชฟกำลังตั้งใจทำอาหารของคุณอยู่" },
  { status: "ready", short: "พร้อมรับ", description: "อาหารพร้อมแล้ว แวะมารับได้เลย" },
  { status: "completed", short: "เสร็จสิ้น", description: "ส่งมอบอาหารเรียบร้อยแล้ว ขอให้อร่อยนะ" },
];
const thaiDateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const illustrationPosition: Record<TrackingStatus, string> = {
  pending: "bg-left-top",
  preparing: "bg-right-top",
  ready: "bg-left-bottom",
  completed: "bg-right-bottom",
};
const statusBackground: Record<TrackingStatus, string> = {
  pending: "border-[#dbecef] bg-[#edf7f8]",
  preparing: "border-[#f1e5cf] bg-[#fff6e9]",
  ready: "border-[#dbead9] bg-[#f0f7ed]",
  completed: "border-[#dfead8] bg-[#f2f7ef]",
};

function Illustration({ status, large = false, dimmed = false }: { status: TrackingStatus; large?: boolean; dimmed?: boolean }) {
  return <span className={`block aspect-square shrink-0 bg-[url('/order-status-illustrations.png')] bg-[length:200%_200%] bg-no-repeat ${illustrationPosition[status]} ${large ? "w-[min(43%,205px)] max-[700px]:w-[40%] max-[400px]:w-[38%]" : "w-20 max-[900px]:w-[65px] max-[400px]:w-[50px]"} ${dimmed ? "opacity-65" : ""}`} aria-hidden="true" />;
}

export function OrderTracker({ cartChanged = false }: { cartChanged?: boolean }) {
  const receipt = useOrderReceipt();
  const receiptCode = receipt?.trackCode ?? null;
  const [input, setInput] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<TrackingView | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const activeNumber = selection && selection.receiptCode === receiptCode ? selection.orderNumber : null;
  const activeKey = activeNumber !== null ? `id:${activeNumber}` : receiptCode ? `code:${receiptCode}` : null;
  const current = view?.key === activeKey ? view : null;
  const order = current?.order;
  const currentStep = order ? steps.findIndex((step) => step.status === order.status) : -1;

  useEffect(() => {
    if (!activeKey) return;
    const key = activeKey;
    let disposed = false;
    let finished = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      if (disposed || controller || !isPageVisible()) return;
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch("/api/orders/track", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(key.startsWith("id:") ? { orderNumber: Number(key.slice(3)) } : { trackCode: key.slice(5) }), cache: "no-store", signal: request.signal,
        });
        const payload: { order?: TrackedOrder } = await response.json();
        if (disposed) return;
        if (response.status === 404 || response.status === 400) {
          finished = true;
          setView({ key, order: null, error: "ไม่พบออเดอร์ กรุณาตรวจสอบหมายเลขออเดอร์" });
        } else if (!response.ok || !payload.order) {
          setView((previous) => ({ key, order: previous?.key === key ? previous.order : null, error: "ยังอัปเดตสถานะไม่ได้ กรุณาลองอีกครั้ง" }));
        } else {
          finished = payload.order.status === "completed";
          setView({ key, order: payload.order, error: null });
        }
      } catch {
        if (!disposed && !request.signal.aborted) setView((previous) => ({ key, order: previous?.key === key ? previous.order : null, error: "ยังอัปเดตสถานะไม่ได้ กรุณาลองอีกครั้ง" }));
      } finally {
        controller = null;
        if (!disposed && !finished && isPageVisible()) timer = setTimeout(() => void refresh(), REFRESH_INTERVAL_MS);
      }
    }

    function onVisibilityChange() {
      if (timer) clearTimeout(timer);
      if (isPageVisible() && !finished) void refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    void refresh();
    return () => { disposed = true; if (timer) clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [activeKey, revision]);

  function submitOrderNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const orderNumber = parseOrderNumber(input);
    if (orderNumber === null) { setInputError("กรุณากรอกหมายเลขออเดอร์ เช่น #ORD-003"); return; }
    setInputError(null);
    setSelection({ orderNumber, receiptCode });
    setRevision((value) => value + 1);
  }

  return <div className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)] min-h-[calc(100vh-140px)] max-w-[1080px] pt-[30px] pb-[72px] max-[700px]:pt-[23px] max-[700px]:pb-[55px]">
    <Link className="inline-flex items-center gap-[7px] text-xs font-bold text-[#6a7d8c] hover:text-[#166aab]" href="/" prefetch={false}><ArrowLeft size={16} aria-hidden="true" /> กลับไปเลือกอาหาร</Link>
    <header className="mt-[27px] mb-6 flex items-end justify-between gap-5 max-[700px]:my-[21px] [&_h1]:mt-1 [&_h1]:mb-[3px] [&_h1]:text-[clamp(26px,3.2vw,38px)] [&_h1]:leading-tight [&_h1]:font-black [&_h1]:tracking-[-.035em] [&_h1]:text-[#253242] [&_p]:mt-[5px] [&_p]:text-[13px] [&_p]:text-[#87949f]"><div><span className="block text-[10px] font-extrabold tracking-[.09em] text-[#8299a7]">YOUR ORDER</span><h1>ติดตามออเดอร์ของคุณ</h1><p>อร่อยใกล้เข้ามาแล้ว ดูความคืบหน้าได้ที่นี่เลย</p></div><span className="grid h-[45px] w-[45px] place-items-center rounded-2xl border border-[#d9e8ed] bg-[#edf7f9] text-[#5594a9] max-[700px]:hidden"><ShoppingBag size={23} aria-hidden="true" /></span></header>
    {cartChanged && <p className="mb-[15px] rounded-xl border border-[#efd9aa] bg-[#fff9e9] px-[15px] py-3 text-xs text-[#8a6632]" role="status">สั่งซื้อเรียบร้อยแล้ว แต่ตะกร้ามีการเปลี่ยนแปลง กรุณาตรวจสอบตะกร้าก่อนสั่งอีกครั้ง</p>}
    <div className="grid grid-cols-[minmax(0,1fr)_315px] items-start gap-5 max-[900px]:grid-cols-[minmax(0,1fr)_280px] max-[900px]:gap-3.5 max-[700px]:grid-cols-1">
      <section className="min-w-0 rounded-[23px] border border-[#e8e6e0] bg-white p-[26px] shadow-[0_8px_25px_#5c493608] max-[900px]:p-5 max-[700px]:p-[18px]" aria-label="สถานะออเดอร์" aria-live="polite">
        {!activeKey ? <div className="flex min-h-[390px] flex-col items-center justify-center p-7 text-center [&>span:first-child]:w-[180px] [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-[#405865] [&_p]:mt-[5px] [&_p]:mb-[18px] [&_p]:max-w-[340px] [&_p]:text-xs [&_p]:leading-[1.7] [&_p]:text-[#91a0a2]"><Illustration status="pending" large /><h2>รอออเดอร์แสนอร่อยของคุณอยู่</h2><p>สั่งอาหารจากหน้าเมนู หรือกรอกหมายเลขออเดอร์เพื่อดูสถานะ</p><Link className="inline-flex min-h-[41px] shrink-0 cursor-pointer items-center justify-center gap-[7px] rounded-[10px] border-0 bg-[#287bad] px-[13px] py-2 text-[11px] font-extrabold text-white hover:bg-[#176591]" href="/" prefetch={false}>ไปเลือกอาหาร <ArrowRight size={16} aria-hidden="true" /></Link></div> : !current ? <div className="flex min-h-[390px] flex-col items-center justify-center p-7 text-center [&>span:first-child]:w-[180px] [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-[#405865] [&_p]:mt-[5px] [&_p]:mb-[18px] [&_p]:max-w-[340px] [&_p]:text-xs [&_p]:leading-[1.7] [&_p]:text-[#91a0a2]"><Illustration status="pending" large /><h2>กำลังตามหาออเดอร์…</h2><p>รอสักครู่นะ</p></div> : order ? <>
          <div className="mb-[19px] flex items-center justify-between gap-3"><div><span className="block text-[10px] font-extrabold tracking-[.09em] text-[#8299a7]">หมายเลขออเดอร์</span><strong className="mt-[5px] block text-[22px] font-bold tracking-[.01em] text-[#244a66]">{formatOrderNumber(order.orderNumber)}</strong></div><button className="inline-flex min-h-[39px] cursor-pointer items-center justify-center gap-[7px] rounded-[11px] border border-[#e1eaf0] bg-white px-3 py-2 text-[11px] font-bold text-[#54738a] hover:bg-[#eff7fb] hover:text-[#176ca9]" type="button" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" /> อัปเดตสถานะ</button></div>
          <div className={`flex min-h-[220px] items-center justify-between gap-3 overflow-hidden rounded-[20px] border px-[27px] py-6 max-[700px]:min-h-[180px] max-[700px]:p-[18px] max-[400px]:gap-1 max-[400px]:p-4 [&_h2]:mt-[13px] [&_h2]:mb-1 [&_h2]:text-[clamp(22px,2.4vw,30px)] [&_h2]:leading-[1.3] [&_h2]:font-black [&_h2]:text-[#284351] max-[400px]:[&_h2]:text-[21px] [&_p]:m-0 [&_p]:text-xs [&_p]:leading-[1.7] [&_p]:text-[#788d91] ${statusBackground[order.status]}`}>
            <div className="min-w-0 flex-1"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9e9eb] bg-[#ffffffb8] px-[9px] py-[5px] text-[10px] font-extrabold text-[#628790]"><span className="h-[7px] w-[7px] rounded-full bg-[#65a9a2]" /> สถานะปัจจุบัน</span><h2>{statusLabel(order.status)}</h2><p>{steps[currentStep]?.description}</p>{order.completedAt && <div className="mt-3 flex items-center gap-1.5 text-[11px] leading-normal font-bold text-[#588262]"><Clock3 size={16} aria-hidden="true" /> เสร็จสิ้นเมื่อ {thaiDateTime.format(new Date(order.completedAt))} น.</div>}</div>
            <Illustration status={order.status} large />
          </div>
          <div className="mt-[29px] mb-[18px] flex items-end justify-between gap-2.5 [&_h2]:m-0 [&_h2]:text-base [&_h2]:font-extrabold [&_h2]:text-[#304453] [&_p]:mt-1 [&_p]:text-[11px] [&_p]:text-[#9ba6ab] [&>span]:text-[10px] [&>span]:whitespace-nowrap [&>span]:text-[#91a1aa]"><div><h2>เส้นทางความอร่อย</h2><p>คอยติดตามแต่ละขั้นตอนได้เลย</p></div><span>ขั้นตอน {currentStep + 1} / 4</span></div>
          <ol className="grid list-none grid-cols-4 pt-2 pb-0.5">{steps.map((step, index) => {
            const isCurrent = index === currentStep;
            const isDone = index < currentStep;
            return <li key={step.status} className={`relative flex min-w-0 flex-col items-center gap-1 text-center before:absolute before:top-[46px] before:left-1/2 before:h-0.5 before:w-full before:content-[''] last:before:hidden max-[900px]:before:top-[38px] max-[400px]:before:top-[29px] ${isDone ? "before:bg-[#8dc2cf]" : "before:bg-[#dce7e8]"}`} aria-current={isCurrent ? "step" : undefined}>
              <span className={`relative z-[1] grid h-[94px] w-[94px] place-items-center rounded-full border-2 max-[900px]:h-[78px] max-[900px]:w-[78px] max-[400px]:h-[60px] max-[400px]:w-[60px] ${isCurrent ? "border-[#4599bd] bg-[#eff9fb] shadow-[0_0_0_5px_#e5f4f7]" : isDone ? "border-[#86bba7] bg-[#f6fbf8]" : "border-[#dce8e9] bg-white"}`}>
                <Illustration status={step.status} dimmed={!isCurrent && !isDone} />
                <span className={`absolute right-[-3px] bottom-px grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-white text-[10px] font-extrabold text-white ${isCurrent ? "bg-[#4599bd]" : isDone ? "bg-[#76a884]" : "bg-[#d7e2e4]"}`}>{isDone ? <Check size={12} aria-hidden="true" /> : index + 1}</span>
              </span>
              <strong className="mt-2.5 text-[11px] text-[#455c67] max-[400px]:text-[10px]">{step.short}</strong>
              <span className={`text-[10px] max-[400px]:text-[9px] ${isCurrent ? "font-bold text-[#5595a9]" : "text-[#a5b0b3]"}`}>{isCurrent ? "ตอนนี้" : isDone ? "เรียบร้อย" : "รออีกนิด"}</span>
            </li>;
          })}</ol>
          {current.error ? <p className="mt-3 block text-[11px] leading-normal text-[#a84d42]" role="status">{current.error} · แสดงสถานะล่าสุดที่ตรวจได้</p> : order.status !== "completed" && <p className="mt-5 flex items-center justify-center gap-[7px] text-[10px] text-[#9aa9ac] [&_span]:h-1.5 [&_span]:w-1.5 [&_span]:rounded-full [&_span]:bg-[#65a9a2]"><span /> อัปเดตอัตโนมัติทุก 30 วินาทีขณะเปิดหน้านี้</p>}
        </> : <div className="flex min-h-[390px] flex-col items-center justify-center p-7 text-center [&>span:first-child]:w-[180px] [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-[#405865] [&_p]:mt-[5px] [&_p]:mb-[18px] [&_p]:max-w-[340px] [&_p]:text-xs [&_p]:leading-[1.7] [&_p]:text-[#91a0a2]"><Illustration status="pending" large /><h2>ยังแสดงออเดอร์ไม่ได้</h2><p className="mt-3 block text-[11px] leading-normal text-[#a84d42]" role="status">{current.error}</p><button className="inline-flex min-h-[39px] cursor-pointer items-center justify-center gap-[7px] rounded-[11px] border border-[#e1eaf0] bg-white px-3 py-2 text-[11px] font-bold text-[#54738a] hover:bg-[#eff7fb] hover:text-[#176ca9]" type="button" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" /> ลองอีกครั้ง</button></div>}
      </section>
      <aside className="grid gap-4 max-[700px]:grid-cols-1">
        {order && <section className="min-w-0 rounded-[23px] border border-[#e8e6e0] bg-white p-[22px] shadow-[0_8px_25px_#5c493608] max-[700px]:p-5 [&_ul]:my-5 [&_ul]:grid [&_ul]:list-none [&_ul]:gap-3.5 [&_ul]:p-0 [&_li]:flex [&_li]:justify-between [&_li]:gap-2.5 [&_li]:text-xs [&_li]:text-[#4d6069] [&_li>span]:min-w-0 [&_li>span]:break-all [&_li_small]:mt-[3px] [&_li_small]:block [&_li_small]:text-[10px] [&_li_small]:text-[#a5b0b2] [&_li_b]:shrink-0 [&_li_b]:text-[#607982]"><div className="flex items-center justify-between gap-2 text-[#89a7b2] [&_h2]:mt-[3px] [&_h2]:text-base [&_h2]:font-extrabold [&_h2]:text-[#324553]"><div><span className="block text-[10px] font-extrabold tracking-[.09em] text-[#8299a7]">YOUR MEAL</span><h2>สรุปออเดอร์</h2></div><ShoppingBag size={20} aria-hidden="true" /></div><p className="mt-[19px] rounded-[11px] bg-[#f6faf9] px-3 py-[11px] text-[11px] break-all text-[#899999] [&_strong]:text-[#526a6b]">สำหรับคุณ <strong>{order.customerName}</strong></p><ul>{order.items.map((item, index) => <li key={`${index}-${item.name}`}><span><strong>{item.name}</strong><small>จำนวน {item.quantity} ที่</small></span><b>{formatPrice(item.priceSatang * item.quantity)} ฿</b></li>)}</ul><div className="flex items-center justify-between gap-2 border-t border-dashed border-[#e4eae8] pt-[17px] text-[11px] font-bold text-[#899a9c] [&_strong]:text-[19px] [&_strong]:text-[#32759b]"><span>ยอดรวมทั้งหมด</span><strong>{formatPrice(order.totalSatang)} ฿</strong></div><div className="mt-[15px] flex items-center gap-1.5 text-[10px] text-[#9eaaac]"><Clock3 size={15} aria-hidden="true" /><span>สั่งเมื่อ {thaiDateTime.format(new Date(order.createdAt))} น.</span></div></section>}
        <section className="min-w-0 rounded-[23px] border border-[#e8e6e0] bg-white p-[22px] shadow-[0_8px_25px_#5c493608] max-[700px]:p-5 [&>p]:mt-[9px] [&>p]:mb-4 [&>p]:text-[11px] [&>p]:leading-normal [&>p]:text-[#9aa8a9] [&_label]:mb-1.5 [&_label]:block [&_label]:text-[10px] [&_label]:font-bold [&_label]:text-[#718b91]"><div className="flex items-center justify-start gap-2 text-[#89a7b2] [&_h2]:m-0 [&_h2]:text-sm [&_h2]:font-extrabold [&_h2]:text-[#324553]"><Search size={18} aria-hidden="true" /><h2>ค้นหาออเดอร์</h2></div><p>กรอกหมายเลขออเดอร์เพื่อดูสถานะได้เลย</p><form onSubmit={submitOrderNumber}><label htmlFor="order-number">หมายเลขออเดอร์</label><div className="flex gap-[7px] [&_input]:min-h-[41px] [&_input]:min-w-0 [&_input]:w-full [&_input]:rounded-[10px] [&_input]:border [&_input]:border-[#e1e9e9] [&_input]:px-2.5 [&_input]:py-[9px] [&_input]:text-[11px] [&_input]:text-[#3f5964] [&_button]:inline-flex [&_button]:min-h-[41px] [&_button]:shrink-0 [&_button]:cursor-pointer [&_button]:items-center [&_button]:justify-center [&_button]:rounded-[10px] [&_button]:border-0 [&_button]:bg-[#287bad] [&_button]:px-[13px] [&_button]:py-2 [&_button]:text-[11px] [&_button]:font-extrabold [&_button]:text-white [&_button:hover]:bg-[#176591]"><input id="order-number" value={input} onChange={(event) => setInput(event.target.value)} placeholder="เช่น #ORD-003" maxLength={16} autoComplete="off" spellCheck={false} /><button type="submit">ค้นหา</button></div>{inputError && <span className="mt-3 block text-[11px] leading-normal text-[#a84d42]" role="alert">{inputError}</span>}</form>{receiptCode && activeNumber !== null && <button type="button" className="mt-2.5 cursor-pointer border-0 bg-transparent p-0 text-[11px] text-[var(--accent-dark)] underline underline-offset-[3px]" onClick={() => { setSelection(null); setInputError(null); }}>ดูออเดอร์ล่าสุดบนอุปกรณ์นี้</button>}</section>
      </aside>
    </div>
  </div>;
}
