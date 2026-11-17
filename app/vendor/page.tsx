import { SiteHeader } from "@/components/site-header";
import { VendorDashboard } from "@/components/vendor-dashboard";

export default function VendorPage() {
  return <><SiteHeader active="vendor" /><main><VendorDashboard /></main><footer className="border-t border-[var(--border)] py-[22px] text-center text-xs text-[#96a4b6]"><div className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)]">©2026 อิ่มจานโปรด</div></footer></>;
}
