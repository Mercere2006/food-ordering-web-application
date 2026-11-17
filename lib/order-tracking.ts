export type TrackingStatus = "pending" | "preparing" | "ready" | "completed";

export type TrackedOrder = {
  orderNumber: number;
  customerName: string;
  status: TrackingStatus;
  totalSatang: number;
  createdAt: string;
  completedAt: string | null;
  items: Array<{ name: string; quantity: number; priceSatang: number }>;
};

export function isOrderNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 4294967295;
}

export function isTrackingCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12}$/.test(value);
}
