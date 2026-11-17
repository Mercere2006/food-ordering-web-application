"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  LogOut,
  RefreshCw,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatPrice } from "@/lib/cart";
import { type TrackingStatus } from "@/lib/order-tracking";

type VendorFilter = "all" | TrackingStatus;
type VendorOrderItem = { name: string; quantity: number; priceSatang?: number };
type VendorOrder = { id: number; customerName: string; status: TrackingStatus; totalSatang: number; createdAt: string; items: VendorOrderItem[] };
type VendorOrders = { orders: VendorOrder[]; counts: Record<VendorFilter, number>; page: number; pages: number };

type FilterTab = {
  value: VendorFilter;
  label: string;
};

const filterTabs: FilterTab[] = [
  { value: "all", label: "ทั้งหมด (All)" },
  { value: "pending", label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
];

const timeFormat = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

function formatOrderTime(isoString: string): string {
  try {
    return timeFormat.format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function formatOrderCode(id: number): string {
  return `#ORD-${String(id).padStart(3, "0")}`;
}

export function VendorDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [filter, setFilter] = useState<VendorFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<VendorOrders | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/vendor/orders?status=${filter}&page=${page}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (response.status === 401) {
          setAuthenticated(false);
          setData(null);
          return;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "ยังโหลดออเดอร์ไม่ได้");
        setAuthenticated(true);
        setData(payload as VendorOrders);
        setError("");
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "ยังโหลดออเดอร์ไม่ได้ กรุณาลองอีกครั้ง"
          );
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [filter, page, revision]);

  // Real-time polling every 5 seconds when visible
  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [authenticated, refresh]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/vendor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "เข้าสู่ระบบไม่ได้");
      setPassword("");
      setAuthenticated(true);
      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "เข้าสู่ระบบไม่ได้ กรุณาลองอีกครั้ง"
      );
    } finally {
      setWorking(false);
    }
  }

  async function logout() {
    setWorking(true);
    try {
      const response = await fetch("/api/vendor/session", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setAuthenticated(false);
      setData(null);
      setError("");
    } catch {
      setError("ออกจากระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setWorking(false);
    }
  }

  async function advance(id: number, status: TrackingStatus) {
    setUpdating(id);
    setError("");
    try {
      const response = await fetch("/api/vendor/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (response.status === 401) {
        setAuthenticated(false);
        setData(null);
        setError("หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง");
        return;
      }
      const payload = await response.json();
      if (!response.ok) {
        refresh();
        throw new Error(payload.error || "เปลี่ยนสถานะไม่ได้");
      }
      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "เปลี่ยนสถานะไม่ได้ กรุณาลองอีกครั้ง"
      );
    } finally {
      setUpdating(null);
    }
  }

  if (!authenticated) {
    return (
      <section className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)] min-h-[calc(100vh-160px)] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
            <Store size={24} aria-hidden="true" />
          </div>
          <p className="text-xs font-bold tracking-wider text-blue-600 uppercase">
            Vendor Dashboard
          </p>
          <h1 className="text-2xl font-black text-slate-900 mt-1 mb-2">
            เข้าสู่ระบบร้านค้า
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            กรอกรหัสผ่านสำหรับดูและจัดการออเดอร์
          </p>

          {authenticated === null && !error ? (
            <p role="status" className="text-slate-400 text-sm py-4">
              กำลังตรวจสอบการเข้าสู่ระบบ…
            </p>
          ) : (
            <form onSubmit={login} className="space-y-4">
              <div>
                <label
                  htmlFor="vendor-password"
                  className="block text-xs font-bold text-slate-700 mb-2"
                >
                  รหัสผ่านร้านค้า
                </label>
                <input
                  id="vendor-password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={256}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="กรอกรหัสผ่านร้านค้า..."
                  required
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={working}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-xs disabled:opacity-50 flex items-center justify-center cursor-pointer"
              >
                {working ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              </button>
            </form>
          )}

          {error && (
            <p className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    );
  }

  const statCards = [
    {
      title: "รอดำเนินการ (Pending)",
      value: data?.counts.pending ?? 0,
      tag: "Amber",
      borderColor: "border-t-amber-400",
      textColor: "text-amber-500",
      tagBg: "bg-amber-50 text-amber-600 border border-amber-200/80",
      filterValue: "pending" as const,
    },
    {
      title: "กำลังทำ (Preparing)",
      value: data?.counts.preparing ?? 0,
      tag: "Blue",
      borderColor: "border-t-blue-500",
      textColor: "text-blue-600",
      tagBg: "bg-blue-50 text-blue-600 border border-blue-200/80",
      filterValue: "preparing" as const,
    },
    {
      title: "พร้อมรับ (Ready)",
      value: data?.counts.ready ?? 0,
      tag: "Green",
      borderColor: "border-t-emerald-500",
      textColor: "text-emerald-500",
      tagBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/80",
      filterValue: "ready" as const,
    },
    {
      title: "เสร็จแล้ว (Completed)",
      value: data?.counts.completed ?? 0,
      tag: "Gray",
      borderColor: "border-t-slate-400",
      textColor: "text-slate-800",
      tagBg: "bg-slate-100 text-slate-600 border border-slate-200/80",
      filterValue: "completed" as const,
    },
  ];

  return (
    <section className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)] max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
        <div className="flex items-start sm:items-center gap-3">
          <div className="text-3xl select-none flex-none pt-0.5 sm:pt-0" aria-hidden="true">
            🏪
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Vendor Dashboard
              </h1>
              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-md border border-slate-200/60">
                แผงจัดการร้านค้า
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              จัดการและอัปเดตสถานะออเดอร์ของลูกค้าแบบ Real-time Workflow
            </p>
          </div>
        </div>

        {/* Right Header Status & Actions */}
        <div className="flex items-center gap-2.5 self-start md:self-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-medium shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>ระบบซิงก์ข้อมูลเรียลไทม์</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={working}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200/70 bg-white shadow-2xs cursor-pointer"
            title="รีเฟรชข้อมูล"
            aria-label="รีเฟรชข้อมูล"
          >
            <RefreshCw size={15} className={working ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={working}
            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition border border-slate-200/70 bg-white shadow-2xs cursor-pointer"
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* 2. Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-2">
        {statCards.map((card) => {
          const isSelected = filter === card.filterValue;
          return (
            <div
              key={card.tag}
              role="button"
              tabIndex={0}
              onClick={() => {
                setFilter((prev) => (prev === card.filterValue ? "all" : card.filterValue));
                setPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setFilter((prev) => (prev === card.filterValue ? "all" : card.filterValue));
                  setPage(1);
                }
              }}
              className={`bg-white rounded-2xl border-x border-b border-slate-200/90 border-t-4 ${card.borderColor} p-5 shadow-xs hover:shadow transition-all text-left cursor-pointer ${
                isSelected ? "ring-2 ring-blue-500/40 bg-slate-50/50" : ""
              }`}
            >
              <div className="text-slate-600 text-xs sm:text-sm font-medium">
                {card.title}
              </div>
              <div className="flex items-end justify-between mt-4">
                <span className={`text-3xl sm:text-4xl font-extrabold ${card.textColor} leading-none`}>
                  {card.value}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${card.tagBg}`}>
                  {card.tag}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Section Bar & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-10 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            รายการออเดอร์ทั้งหมด
          </h2>
        </div>

        {/* Filter Pills */}
        <div
          className="inline-flex flex-wrap items-center bg-slate-100 p-1 rounded-full border border-slate-200/60"
          role="tablist"
          aria-label="กรองสถานะออเดอร์"
        >
          {filterTabs.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(tab.value);
                  setPage(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 font-medium"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs sm:text-sm flex items-center justify-between" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="underline font-bold hover:text-rose-700 ml-4 cursor-pointer"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* 4. Orders Grid */}
      {!data ? (
        <div className="py-24 text-center text-slate-400 text-sm">
          กำลังโหลดรายการออเดอร์…
        </div>
      ) : data.orders.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-dashed border-slate-200 rounded-3xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-3">
            <ClipboardList size={28} aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-700 mb-1">
            ยังไม่มีออเดอร์ในสถานะนี้
          </h3>
          <p className="text-xs text-slate-400">
            เมื่อมีลูกค้าสั่งอาหาร ระบบจะอัปเดตออเดอร์เข้ามาที่นี่ทันที
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.orders.map((order) => {
            const isCompleted = order.status === "completed";
            const isReady = order.status === "ready";
            const isPreparing = order.status === "preparing";
            const isPending = order.status === "pending";

            return (
              <article
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50/90 border border-blue-100/70 px-2 py-0.5 rounded-md tracking-wider">
                      {formatOrderCode(order.id)}
                    </span>

                    {/* Status Badge */}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                        <Check size={13} className="text-slate-600" />
                        <span>รับอาหารแล้ว</span>
                      </span>
                    )}
                    {isReady && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                        <span>พร้อมรับ</span>
                      </span>
                    )}
                    {isPreparing && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                        <span>กำลังทำ</span>
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                        <span>รอดำเนินการ</span>
                      </span>
                    )}
                  </div>

                  {/* Customer Info */}
                  <h3 className="text-lg font-bold text-slate-900 mt-3 mb-1">
                    {order.customerName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-3">
                    <Clock size={13} aria-hidden="true" />
                    <span>{formatOrderTime(order.createdAt)}</span>
                  </div>

                  {/* Food Items List */}
                  <ul className="space-y-1.5 py-3 border-y border-slate-100 my-2">
                    {order.items.map((item, index) => {
                      const itemTotal = item.priceSatang != null
                        ? item.priceSatang * item.quantity
                        : (order.totalSatang / Math.max(1, order.items.reduce((sum, i) => sum + i.quantity, 0))) * item.quantity;
                      return (
                        <li
                          key={`${index}-${item.name}`}
                          className="flex items-start justify-between gap-2 text-xs sm:text-sm"
                        >
                          <span className="text-slate-700 font-normal">
                            - {item.name}{" "}
                            <span className="text-slate-500 font-medium">
                              x {item.quantity}
                            </span>
                          </span>
                          <span className="font-bold text-slate-900 flex-none">
                            {formatPrice(itemTotal)} ฿
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Bottom Section: Total & Advance Action Button */}
                <div className="flex items-end justify-between pt-3 mt-auto">
                  <div>
                    <span className="text-slate-400 text-xs font-medium block">
                      ยอดรวม:
                    </span>
                    <span className="text-amber-500 font-black text-xl leading-none">
                      {formatPrice(order.totalSatang)} ฿
                    </span>
                  </div>

                  <div>
                    {isCompleted ? (
                      <span className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-100 rounded-xl cursor-default select-none">
                        เสร็จสิ้น
                      </span>
                    ) : isReady ? (
                      <button
                        type="button"
                        disabled={updating !== null}
                        onClick={() => void advance(order.id, order.status)}
                        className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {updating === order.id ? "กำลังบันทึก…" : "ส่งมอบอาหารแล้ว"}
                      </button>
                    ) : isPreparing ? (
                      <button
                        type="button"
                        disabled={updating !== null}
                        onClick={() => void advance(order.id, order.status)}
                        className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {updating === order.id ? "กำลังบันทึก…" : "อาหารพร้อมรับ"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updating !== null}
                        onClick={() => void advance(order.id, order.status)}
                        className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {updating === order.id ? "กำลังบันทึก…" : "เริ่มทำอาหาร"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination if multiple pages */}
      {data && data.pages > 1 && (
        <nav
          className="flex items-center justify-center gap-3 mt-10 text-xs sm:text-sm text-slate-600"
          aria-label="หน้ารายการออเดอร์"
        >
          <button
            type="button"
            disabled={data.page <= 1}
            onClick={() => setPage(data.page - 1)}
            className="inline-flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={16} />
            <span>ก่อนหน้า</span>
          </button>
          <span className="font-medium px-2">
            หน้า {data.page} / {data.pages}
          </span>
          <button
            type="button"
            disabled={data.page >= data.pages}
            onClick={() => setPage(data.page + 1)}
            className="inline-flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <span>ถัดไป</span>
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </section>
  );
}
