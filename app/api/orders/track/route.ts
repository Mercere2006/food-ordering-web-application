import { isTrackingCode } from "@/lib/order-tracking";
import { findTrackedOrder } from "@/lib/order-tracking-service";

const headers = { "Cache-Control": "no-store, private" };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || !("trackCode" in body) || !isTrackingCode(body.trackCode)) {
    return Response.json({ message: "กรุณาตรวจสอบรหัสติดตาม" }, { status: 400, headers });
  }
  try {
    const order = await findTrackedOrder(body.trackCode);
    if (!order) return Response.json({ message: "ไม่พบออเดอร์ กรุณาตรวจสอบรหัสติดตาม" }, { status: 404, headers });
    return Response.json({ order }, { headers });
  } catch {
    return Response.json({ message: "ยังตรวจสอบสถานะไม่ได้ กรุณาลองอีกครั้ง" }, { status: 503, headers });
  }
}
