export type TrackingStatus = "pending" | "preparing" | "ready" | "completed";

export type TrackedOrder = {
  orderNumber: number;
  customerName: string;
  status: TrackingStatus;
  totalSatang: number;
  createdAt: string;
  items: Array<{ name: string; quantity: number; priceSatang: number }>;
};

const STATUS_LABELS: Record<TrackingStatus, string> = {
  pending: "รอดำเนินการ",
  preparing: "กำลังเตรียมอาหาร",
  ready: "พร้อมรับอาหาร",
  completed: "รับอาหารแล้ว",
};

export function isTrackingCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12}$/.test(value);
}

export function statusLabel(status: TrackingStatus): string {
  return STATUS_LABELS[status];
}
