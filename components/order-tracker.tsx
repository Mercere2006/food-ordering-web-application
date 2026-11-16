"use client";

import { ClipboardList, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { formatPrice } from "@/lib/cart";
import { isTrackingCode, statusLabel, type TrackedOrder } from "@/lib/order-tracking";
import { useOrderReceipt } from "@/lib/order-receipt-store";

type Selection = { code: string; receiptCode: string | null };
type TrackingView = { code: string; order: TrackedOrder | null; error: string | null };
const REFRESH_INTERVAL_MS = 30_000;
const isPageVisible = () => document.visibilityState !== "hidden";

export function OrderTracker() {
  const receipt = useOrderReceipt();
  const receiptCode = receipt?.trackCode ?? null;
  const [input, setInput] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<TrackingView | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const activeCode = selection && selection.receiptCode === receiptCode ? selection.code : receiptCode;
  const current = view?.code === activeCode ? view : null;

  useEffect(() => {
    if (!activeCode) return;
    const code = activeCode;
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
          body: JSON.stringify({ trackCode: code }), cache: "no-store", signal: request.signal,
        });
        const payload: { order?: TrackedOrder } = await response.json();
        if (disposed) return;
        if (response.status === 404 || response.status === 400) {
          finished = true;
          setView({ code, order: null, error: "ไม่พบออเดอร์ กรุณาตรวจสอบรหัสติดตาม" });
        } else if (!response.ok || !payload.order) {
          setView((previous) => ({ code, order: previous?.code === code ? previous.order : null, error: "ยังอัปเดตสถานะไม่ได้ กรุณาลองอีกครั้ง" }));
        } else {
          finished = payload.order.status === "completed";
          setView({ code, order: payload.order, error: null });
        }
      } catch {
        if (!disposed && !request.signal.aborted) setView((previous) => ({ code, order: previous?.code === code ? previous.order : null, error: "ยังอัปเดตสถานะไม่ได้ กรุณาลองอีกครั้ง" }));
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
  }, [activeCode, revision]);

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = input.trim();
    if (!isTrackingCode(code)) { setInputError("กรุณากรอกรหัสติดตามให้ครบ 12 ตัว"); return; }
    setInputError(null);
    setSelection({ code, receiptCode });
    setRevision((value) => value + 1);
  }

  return (
    <section className="side-panel tracking-preview" aria-labelledby="tracking-heading">
      <div className="panel-title"><ClipboardList aria-hidden="true" size={19} /><h2 id="tracking-heading">ติดตามสถานะออเดอร์</h2></div>
      <form className="tracking-form" onSubmit={submitCode}>
        <label htmlFor="tracking-code">รหัสติดตามออเดอร์</label>
        <div className="tracking-controls"><input id="tracking-code" value={input} onChange={(event) => setInput(event.target.value)} placeholder="กรอกรหัส 12 ตัว" maxLength={12} autoComplete="off" spellCheck={false} /><button type="submit">ค้นหา</button></div>
        {inputError && <span className="tracking-input-error" role="alert">{inputError}</span>}
      </form>
      {receiptCode && activeCode !== receiptCode && <button type="button" className="tracking-latest" onClick={() => { setSelection(null); setInputError(null); }}>ดูออเดอร์ล่าสุดบนอุปกรณ์นี้</button>}
      {!activeCode ? <p>เมื่อสั่งซื้อสำเร็จ สถานะจะแสดงที่นี่ หรือกรอกรหัสเพื่อติดตามออเดอร์</p> : (
        <div className="tracking-result" aria-live="polite">
          <div className="tracking-result-head"><span>รหัสติดตาม: <b>{activeCode}</b></span><button type="button" onClick={() => setRevision((value) => value + 1)} aria-label="อัปเดตสถานะออเดอร์"><RefreshCw size={15} aria-hidden="true" /></button></div>
          {!current && <p role="status">กำลังตรวจสอบสถานะ…</p>}
          {current?.order && (
            <article className="tracked-order">
              <div className="tracked-order-head"><strong>ออเดอร์ #{current.order.orderNumber}</strong><span className={`order-status ${current.order.status}`}>{statusLabel(current.order.status)}</span></div>
              <p>คุณ{current.order.customerName}</p>
              <ul>{current.order.items.map((item, index) => <li key={`${index}-${item.name}`}>{item.name} × {item.quantity}</li>)}</ul>
              <div className="tracked-order-total"><span>ยอดรวม</span><strong>{formatPrice(current.order.totalSatang)} ฿</strong></div>
              {current.error && <small>แสดงสถานะล่าสุดที่ตรวจได้</small>}
            </article>
          )}
          {current?.error && <p className="tracking-error" role="status">{current.error}</p>}
          {current?.order && current.order.status !== "completed" && !current.error && <small className="tracking-hint">อัปเดตทุก 30 วินาทีขณะเปิดหน้านี้</small>}
        </div>
      )}
    </section>
  );
}
