import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { OrderTracker } from "@/components/order-tracker";

async function TrackingContent({ searchParams }: { searchParams: Promise<{ cart?: string }> }) {
  const params = await searchParams;
  return <OrderTracker cartChanged={params.cart === "changed"} />;
}

export default function TrackingPage({ searchParams }: { searchParams: Promise<{ cart?: string }> }) {
  return <><SiteHeader active="tracking" /><main><Suspense fallback={<div className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)] py-[70px] px-5 text-center text-[var(--muted)]">กำลังโหลด…</div>}><TrackingContent searchParams={searchParams} /></Suspense></main><footer className="border-t border-[var(--border)] py-[22px] text-center text-xs text-[#96a4b6]"><div className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)]">©2026 อิ่มจานโปรด</div></footer></>;
}
