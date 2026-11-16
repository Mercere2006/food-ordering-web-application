import { prisma } from "@/lib/prisma";
import { nextOrderStatus, type VendorFilter, type VendorOrders } from "@/lib/vendor";
import type { TrackingStatus } from "@/lib/order-tracking";

const PAGE_SIZE = 24;

export async function listVendorOrders(filter: VendorFilter, requestedPage: number): Promise<VendorOrders> {
  const grouped = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = { all: 0, pending: 0, preparing: 0, ready: 0, completed: 0 };
  for (const group of grouped) { counts[group.status] = group._count._all; counts.all += group._count._all; }
  const pages = Math.max(1, Math.ceil(counts[filter] / PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pages);
  const orders = await prisma.order.findMany({
    where: filter === "all" ? {} : { status: filter },
    orderBy: { id: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: { id: true, customerName: true, status: true, total: true, createdAt: true, items: { select: { foodName: true, quantity: true, price: true }, orderBy: { id: "asc" } } },
  });
  return { counts, page, pages, orders: orders.map((order) => ({ id: order.id, customerName: order.customerName, status: order.status, totalSatang: order.total.mul(100).toNumber(), createdAt: order.createdAt.toISOString(), items: order.items.map((item) => ({ name: item.foodName, quantity: item.quantity, priceSatang: item.price.mul(100).toNumber() })) })) };
}

export async function advanceVendorOrder(id: unknown, status: unknown): Promise<boolean> {
  const next = nextOrderStatus(status);
  if (!Number.isSafeInteger(id) || typeof id !== "number" || id < 1 || id > 4294967295 || !next) return false;
  const result = await prisma.order.updateMany({ where: { id, status: status as TrackingStatus }, data: { status: next, updatedAt: new Date() } });
  return result.count === 1;
}
