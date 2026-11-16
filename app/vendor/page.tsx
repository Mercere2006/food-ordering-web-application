import { SiteHeader } from "@/components/site-header";
import { VendorDashboard } from "@/components/vendor-dashboard";

export default function VendorPage() {
  return <><SiteHeader active="vendor" /><main><VendorDashboard /></main><footer className="site-footer"><div className="container">อิ่มจานโปรด</div></footer></>;
}
