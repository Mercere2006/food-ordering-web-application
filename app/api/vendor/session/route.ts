import { NextResponse } from "next/server";
import { createVendorSession, validVendorPassword, VENDOR_COOKIE, VENDOR_SESSION_SECONDS } from "@/lib/vendor-auth";

const headers = { "Cache-Control": "no-store, private" };

export async function POST(request: Request) {
  const password = process.env.VENDOR_PASSWORD;
  if (!password || password.length < 1) return NextResponse.json({ error: "ยังไม่ได้ตั้งรหัสผ่านร้านค้าในไฟล์ .env" }, { status: 503, headers });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers }); }
  const candidate = typeof input === "object" && input !== null && "password" in input ? input.password : null;
  if (!validVendorPassword(candidate, password)) return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401, headers });
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(VENDOR_COOKIE, createVendorSession(password), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: VENDOR_SESSION_SECONDS });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(VENDOR_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
