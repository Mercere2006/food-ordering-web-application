import type { TrackingStatus } from "@/lib/order-tracking";

export type VendorFilter = "all" | TrackingStatus;
export type VendorOrderItem = { name: string; quantity: number; priceSatang?: number };
export type VendorOrder = { id: number; customerName: string; status: TrackingStatus; totalSatang: number; createdAt: string; items: VendorOrderItem[] };
export type VendorOrders = { orders: VendorOrder[]; counts: Record<VendorFilter, number>; page: number; pages: number };

export function nextOrderStatus(status: unknown): TrackingStatus | null {
  switch (status) {
    case "pending": return "preparing";
    case "preparing": return "ready";
    case "ready": return "completed";
    default: return null;
  }
}

export function validVendorFilter(value: unknown): value is VendorFilter {
  return value === "all" || value === "pending" || value === "preparing" || value === "ready" || value === "completed";
}
