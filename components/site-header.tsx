import { Store, UserRound, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export function SiteHeader({ active }: { active: "customer" | "vendor" }) {
  return <header className="site-header"><div className="container header-inner">
    <Link href="/" className="brand" aria-label="อิ่มจานโปรด หน้าหลัก"><span className="brand-mark"><UtensilsCrossed size={20} aria-hidden="true" /></span><span>อิ่มจานโปรด<small>สั่งอาหารง่าย ๆ ในหน้าเดียว</small></span></Link>
    <nav className="view-nav" aria-label="มุมมอง">
      <Link href="/" prefetch={false} className={active === "customer" ? "view-current" : "view-link"} aria-current={active === "customer" ? "page" : undefined}><UserRound size={16} aria-hidden="true" /> หน้าลูกค้า</Link>
      <Link href="/vendor" prefetch={false} className={active === "vendor" ? "view-current" : "view-link"} aria-current={active === "vendor" ? "page" : undefined}><Store size={16} aria-hidden="true" /> หน้าร้านค้า</Link>
    </nav>
  </div></header>;
}
