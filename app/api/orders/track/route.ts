import { isOrderNumber, isTrackingCode } from "@/lib/order-tracking";
import { prisma } from "@/lib/prisma";

const headers = { "Cache-Control": "no-store, private" };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400, headers });
  }
  if (!body || typeof body !== "object") return Response.json({ message: "กรุณาตรวจสอบหมายเลขออเดอร์" }, { status: 400, headers });
  const trackCode = "trackCode" in body && isTrackingCode(body.trackCode) ? body.trackCode : null;
  const orderNumber = "orderNumber" in body && isOrderNumber(body.orderNumber) ? body.orderNumber : null;
  if ((trackCode === null) === (orderNumber === null)) return Response.json({ message: "กรุณาตรวจสอบหมายเลขออเดอร์" }, { status: 400, headers });
  try {
    const saved = await prisma.order.findUnique({
      where: trackCode !== null ? { trackCode } : { id: orderNumber! },
      select: {
        id: true, trackCode: true, customerName: true, status: true, total: true, createdAt: true, updatedAt: true,
        items: { select: { foodName: true, quantity: true, price: true }, orderBy: { id: "asc" } },
      },
    });
    // MySQL อาจค้นหาโดยไม่แยกตัวพิมพ์เล็ก–ใหญ่ แต่รหัสออเดอร์ต้องตรงกันทุกตัว
    if (!saved || (trackCode !== null && saved.trackCode !== trackCode)) return Response.json({ message: "ไม่พบออเดอร์ กรุณาตรวจสอบหมายเลขออเดอร์" }, { status: 404, headers });
    const order = {
      orderNumber: saved.id,
      customerName: saved.customerName,
      status: saved.status,
      totalSatang: saved.total.mul(100).toNumber(),
      createdAt: saved.createdAt.toISOString(),
      completedAt: saved.status === "completed" ? saved.updatedAt.toISOString() : null,
      items: saved.items.map((item) => ({ name: item.foodName, quantity: item.quantity, priceSatang: item.price.mul(100).toNumber() })),
    };
    return Response.json({ order }, { headers });
  } catch {
    return Response.json({ message: "ยังตรวจสอบสถานะไม่ได้ กรุณาลองอีกครั้ง" }, { status: 503, headers });
  }
}
