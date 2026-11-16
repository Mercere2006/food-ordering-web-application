import { prisma } from "@/lib/prisma";
import { isTrackingCode, type TrackedOrder } from "@/lib/order-tracking";

export async function findTrackedOrder(trackCode: string): Promise<TrackedOrder | null> {
  if (!isTrackingCode(trackCode)) return null;
  const order = await prisma.order.findUnique({
    where: { trackCode },
    select: {
      id: true, trackCode: true, customerName: true, status: true, total: true, createdAt: true,
      items: { select: { foodName: true, quantity: true, price: true }, orderBy: { id: "asc" } },
    },
  });
  // MySQL's collation can match different letter case; the tracking secret cannot.
  if (!order || order.trackCode !== trackCode) return null;
  return {
    orderNumber: order.id,
    customerName: order.customerName,
    status: order.status,
    totalSatang: order.total.mul(100).toNumber(),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({ name: item.foodName, quantity: item.quantity, priceSatang: item.price.mul(100).toNumber() })),
  };
}
