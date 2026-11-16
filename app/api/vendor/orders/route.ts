import { NextRequest, NextResponse } from "next/server";
import { isValidVendorSession, VENDOR_COOKIE } from "@/lib/vendor-auth";
import { validVendorFilter } from "@/lib/vendor";
import { advanceVendorOrder, listVendorOrders } from "@/lib/vendor-service";

const headers = { "Cache-Control": "no-store, private" };
const unauthorized = () => NextResponse.json({ error: "กรุณาเข้าสู่ระบบร้านค้า" }, { status: 401, headers });
const authorized = (request: NextRequest) => isValidVendorSession(request.cookies.get(VENDOR_COOKIE)?.value, process.env.VENDOR_PASSWORD);

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  const filter = request.nextUrl.searchParams.get("status") ?? "all";
  const pageText = request.nextUrl.searchParams.get("page") ?? "1";
  if (!validVendorFilter(filter) || !/^[1-9]\d{0,6}$/.test(pageText)) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers });
  try { return NextResponse.json(await listVendorOrders(filter, Number(pageText)), { headers }); }
  catch { return NextResponse.json({ error: "ยังโหลดออเดอร์ไม่ได้ กรุณาลองอีกครั้ง" }, { status: 503, headers }); }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers }); }
  if (typeof input !== "object" || input === null || !("id" in input) || !("status" in input)) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers });
  try {
    if (!await advanceVendorOrder(input.id, input.status)) return NextResponse.json({ error: "สถานะเปลี่ยนไปแล้ว กรุณาอัปเดตรายการ" }, { status: 409, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "ยังเปลี่ยนสถานะไม่ได้ กรุณาลองอีกครั้ง" }, { status: 503, headers }); }
}
