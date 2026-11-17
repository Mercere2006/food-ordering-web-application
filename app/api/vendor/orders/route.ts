import { NextRequest, NextResponse } from "next/server";
import { isValidVendorSession, VENDOR_COOKIE } from "@/lib/vendor-auth";
import { prisma } from "@/lib/prisma";
import type { TrackingStatus } from "@/lib/order-tracking";

type VendorFilter = "all" | TrackingStatus;

function validVendorFilter(value: unknown): value is VendorFilter {
  return value === "all" || value === "pending" || value === "preparing" || value === "ready" || value === "completed";
}

function nextOrderStatus(status: unknown): TrackingStatus | null {
  switch (status) {
    case "pending": return "preparing";
    case "preparing": return "ready";
    case "ready": return "completed";
    default: return null;
  }
}

const headers = { "Cache-Control": "no-store, private" };
const unauthorized = () => NextResponse.json({ error: "กรุณาเข้าสู่ระบบร้านค้า" }, { status: 401, headers });
const authorized = (request: NextRequest) => isValidVendorSession(request.cookies.get(VENDOR_COOKIE)?.value, process.env.VENDOR_PASSWORD);

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  const filter = request.nextUrl.searchParams.get("status") ?? "all";
  const pageText = request.nextUrl.searchParams.get("page") ?? "1";
  if (!validVendorFilter(filter) || !/^[1-9]\d{0,6}$/.test(pageText)) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers });
  try {
    const pageSize = 24;
    const grouped = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
    const counts = { all: 0, pending: 0, preparing: 0, ready: 0, completed: 0 };
    for (const group of grouped) { counts[group.status] = group._count._all; counts.all += group._count._all; }
    const pages = Math.max(1, Math.ceil(counts[filter] / pageSize));
    const page = Math.min(Number(pageText), pages);
    const saved = await prisma.order.findMany({
      where: filter === "all" ? {} : { status: filter },
      orderBy: { id: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, customerName: true, status: true, total: true, createdAt: true, items: { select: { foodName: true, quantity: true, price: true }, orderBy: { id: "asc" } } },
    });
    const orders = saved.map((order) => ({ id: order.id, customerName: order.customerName, status: order.status, totalSatang: order.total.mul(100).toNumber(), createdAt: order.createdAt.toISOString(), items: order.items.map((item) => ({ name: item.foodName, quantity: item.quantity, priceSatang: item.price.mul(100).toNumber() })) }));
    return NextResponse.json({ orders, counts, page, pages }, { headers });
  }
  catch { return NextResponse.json({ error: "ยังโหลดออเดอร์ไม่ได้ กรุณาลองอีกครั้ง" }, { status: 503, headers }); }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers }); }
  if (typeof input !== "object" || input === null || !("id" in input) || !("status" in input)) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers });
  try {
    const next = nextOrderStatus(input.status);
    if (typeof input.id !== "number" || !Number.isSafeInteger(input.id) || input.id < 1 || input.id > 4294967295 || !next) return NextResponse.json({ error: "สถานะเปลี่ยนไปแล้ว กรุณาอัปเดตรายการ" }, { status: 409, headers });
    const result = await prisma.order.updateMany({ where: { id: input.id, status: input.status as TrackingStatus }, data: { status: next, updatedAt: new Date() } });
    if (result.count !== 1) return NextResponse.json({ error: "สถานะเปลี่ยนไปแล้ว กรุณาอัปเดตรายการ" }, { status: 409, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "ยังเปลี่ยนสถานะไม่ได้ กรุณาลองอีกครั้ง" }, { status: 503, headers }); }
}
