import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { CartPanel } from "@/components/cart-panel";
import { FoodImage } from "@/components/food-image";
import { SiteHeader } from "@/components/site-header";
import { selectedCategoryId } from "@/lib/menu-filter";
import { prisma } from "@/lib/prisma";

type MenuSearchParams = Promise<{ category?: string | string[] }>;

function availableImage(imageUrl: string): string | null {
  if (imageUrl.startsWith("https://")) return imageUrl;
  if (!imageUrl.startsWith("/foods/")) return null;
  const foodsDirectory = path.resolve(process.cwd(), "public", "foods");
  const imagePath = path.resolve(foodsDirectory, imageUrl.slice("/foods/".length));
  return imagePath.startsWith(`${foodsDirectory}${path.sep}`) && existsSync(imagePath) ? imageUrl : null;
}

async function MenuContent({ searchParams }: { searchParams: MenuSearchParams }) {
  await connection();
  const [categories, params] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    searchParams,
  ]);
  const categoryId = selectedCategoryId(params.category, categories);
  const foods = await prisma.food.findMany({
    where: { isAvailable: true, ...(categoryId === null ? {} : { categoryId }) },
    include: { category: true },
    orderBy: { id: "asc" },
  });
  const selectedName = categories.find((category) => category.id === categoryId)?.name;
  const price = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

  return (
    <section className="scroll-mt-5 pt-8 pb-[70px] max-[700px]:pt-[26px]" id="menu" aria-labelledby="categories-heading">
      <div className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)]">
        <div className="relative mb-1 inline-block [&_h2]:m-0 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-[-.01em] [&_h2]:text-[#2e1d14]">
          <h2 className="m-0 text-[17px] leading-[1.4] font-extrabold" id="categories-heading">เมนูทั้งหมด</h2>
          <svg className="absolute -bottom-[7px] left-1 h-3 w-20" viewBox="0 0 100 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M 4 7 Q 45 13 96 4" stroke="#8b261e" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>
        <nav className="flex gap-2 overflow-x-auto pt-3 pb-1.5 [scrollbar-width:thin]" aria-label="เลือกหมวดหมู่อาหาร">
          <Link href="/#menu" scroll={false} prefetch={false} className="inline-flex min-h-9 shrink-0 items-center rounded-[14px] border border-[#ebdccb] bg-white px-4 py-1.5 text-[13px] font-bold text-[#5a463a] transition-all hover:bg-[#f5ece1] hover:text-[#3d2a1e] aria-[current=page]:border-[#8b261e] aria-[current=page]:bg-[#8b261e] aria-[current=page]:text-white aria-[current=page]:shadow-[0_3px_8px_#8b261e30] motion-reduce:transition-none" aria-current={categoryId === null ? "page" : undefined}>ทั้งหมด</Link>
          {categories.map((category) => <Link key={category.id} href={`/?category=${category.id}#menu`} scroll={false} prefetch={false} className="inline-flex min-h-9 shrink-0 items-center rounded-[14px] border border-[#ebdccb] bg-white px-4 py-1.5 text-[13px] font-bold text-[#5a463a] transition-all hover:bg-[#f5ece1] hover:text-[#3d2a1e] aria-[current=page]:border-[#8b261e] aria-[current=page]:bg-[#8b261e] aria-[current=page]:text-white aria-[current=page]:shadow-[0_3px_8px_#8b261e30] motion-reduce:transition-none" aria-current={categoryId === category.id ? "page" : undefined}>{category.name}</Link>)}
        </nav>
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)_384px] items-start gap-8 max-[1000px]:grid-cols-[minmax(0,1fr)_310px] max-[1000px]:gap-5 max-[700px]:mt-[23px] max-[700px]:grid-cols-1 max-[700px]:gap-[30px]">
          <div className="min-w-0">
            <div className="mt-0.5 mb-[18px] flex min-h-6 items-baseline justify-between gap-3 [&_h2]:m-0 [&_h2]:text-[17px] [&_h2]:leading-[1.4] [&_h2]:font-extrabold [&_span]:text-xs [&_span]:whitespace-nowrap [&_span]:text-[var(--muted)]" aria-live="polite"><h2>{selectedName ?? "รายการอาหารทั้งหมด"}</h2><span>แสดง {foods.length} รายการ</span></div>
            {foods.length === 0 ? <div className="px-5 py-[70px] text-center text-[var(--muted)] [&_a]:text-[var(--accent-dark)] [&_a]:underline [&_a]:underline-offset-4"><p>ยังไม่มีเมนูในหมวดหมู่นี้</p><Link href="/#menu">ดูเมนูทั้งหมด</Link></div> : (
              <div className="grid grid-cols-3 gap-[18px] max-[1000px]:grid-cols-2 max-[370px]:gap-2.5">
                {foods.map((food) => (
                  <article className="flex min-w-0 flex-col justify-between overflow-hidden rounded-[22px] border border-[#ebdccb] bg-[#ffffffea] shadow-[0_2px_8px_#3d231108] backdrop-blur-[4px] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_#3d231114]" key={food.id}>
                    <div className="relative"><FoodImage src={availableImage(food.imageUrl)} name={food.name} /><span className="absolute top-[11px] left-[11px] max-w-[calc(100%-22px)] overflow-hidden rounded-full border border-[#ecdcd0] bg-[#fffffff0] px-[9px] py-[3px] text-[10px] font-bold text-ellipsis whitespace-nowrap text-[#4a3629]">{food.category.name}</span></div>
                    <div className="flex flex-1 flex-col justify-between px-[15px] pt-[14px] pb-4 max-[370px]:p-3 [&_h3]:m-0 [&_h3]:text-base [&_h3]:leading-[1.35] [&_h3]:font-extrabold [&_h3]:text-[#2c1b12] max-[370px]:[&_h3]:text-[13px]">
                      <div>
                        <h3>{food.name}</h3>
                        {food.description ? <p className="mt-[5px] mb-2.5 line-clamp-2 min-h-[35px] text-xs leading-[1.45] text-[#786455]">{food.description}</p> : null}
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2.5 pt-1.5">
                        <p className="m-0 text-[17px] font-black text-[#8b261e]">฿ {price.format(Number(food.price))}</p>
                        <AddToCartButton food={{ id: food.id, name: food.name, priceSatang: Math.round(Number(food.price) * 100) }} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <CartPanel />
        </div>
      </div>
    </section>
  );
}

function MenuLoading() {
  return <section className="scroll-mt-5 pt-8 pb-[70px] max-[700px]:pt-[26px]"><div className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)] py-[70px] px-5 text-center text-[var(--muted)]" role="status">กำลังโหลดเมนูอาหาร…</div></section>;
}

export default function Home({ searchParams }: { searchParams: MenuSearchParams }) {
  return (
    <>
      <SiteHeader active="customer" />
      <main className="relative min-h-[calc(100vh-140px)] overflow-x-clip">
        <svg className="pointer-events-none absolute top-[360px] left-0 z-0 h-[240px] w-[90px] opacity-75 max-[900px]:hidden" viewBox="0 0 100 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M 0 20 Q 55 90 15 220" stroke="#798d6c" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 20 40 C 38 28 55 30 60 36 C 52 48 38 48 20 40 Z" fill="#7f9372" opacity="0.85" />
          <path d="M 32 68 C 50 56 68 62 72 70 C 60 80 46 78 32 68 Z" fill="#8ca07f" opacity="0.9" />
          <path d="M 22 85 C 6 68 4 52 8 48 C 20 54 24 72 22 85 Z" fill="#748867" opacity="0.8" />
          <path d="M 30 110 C 48 100 64 108 66 116 C 54 124 40 120 30 110 Z" fill="#829675" opacity="0.85" />
          <path d="M 22 130 C 6 115 5 100 10 95 C 20 102 24 118 22 130 Z" fill="#798d6c" opacity="0.8" />
          <path d="M 24 155 C 38 145 52 152 54 160 C 42 168 32 164 24 155 Z" fill="#8ca07f" opacity="0.85" />
          <path d="M 16 175 C 2 160 3 148 7 144 C 16 150 18 165 16 175 Z" fill="#748867" opacity="0.8" />
        </svg>

        <svg className="pointer-events-none absolute right-[10px] bottom-0 z-0 h-[140px] w-[280px] opacity-[.65] max-[900px]:h-[90px] max-[900px]:w-[180px] max-[900px]:opacity-30" viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M 170 65 L 210 25 L 270 65 Z" stroke="#8a7364" strokeWidth="2.5" strokeLinejoin="round" fill="#fdfbf7" />
          <rect x="180" y="65" width="85" height="55" rx="3" stroke="#8a7364" strokeWidth="2.5" fill="#fdfbf7" />
          <rect x="200" y="75" width="20" height="20" stroke="#8a7364" strokeWidth="2" />
          <line x1="200" y1="85" x2="220" y2="85" stroke="#8a7364" strokeWidth="1.5" />
          <line x1="210" y1="75" x2="210" y2="95" stroke="#8a7364" strokeWidth="1.5" />
          <line x1="75" y1="105" x2="185" y2="105" stroke="#9d8677" strokeWidth="2" />
          <line x1="75" y1="116" x2="185" y2="116" stroke="#9d8677" strokeWidth="2" />
          <path d="M 85 96 L 90 90 L 95 96 L 95 125 L 85 125 Z" stroke="#9d8677" strokeWidth="1.5" fill="#faf6ef" />
          <path d="M 105 96 L 110 90 L 115 96 L 115 125 L 105 125 Z" stroke="#9d8677" strokeWidth="1.5" fill="#faf6ef" />
          <path d="M 125 96 L 130 90 L 135 96 L 135 125 L 125 125 Z" stroke="#9d8677" strokeWidth="1.5" fill="#faf6ef" />
          <path d="M 145 96 L 150 90 L 155 96 L 155 125 L 145 125 Z" stroke="#9d8677" strokeWidth="1.5" fill="#faf6ef" />
          <path d="M 165 96 L 170 90 L 175 96 L 175 125 L 165 125 Z" stroke="#9d8677" strokeWidth="1.5" fill="#faf6ef" />
          <ellipse cx="40" cy="123" rx="14" ry="4" fill="#d9cabb" />
          <path d="M 30 110 L 50 110 L 46 126 L 34 126 Z" fill="#ba6d52" stroke="#8b4a34" strokeWidth="1.5" />
          <path d="M 40 110 C 35 95 22 90 18 94 C 25 102 34 105 40 110 Z" fill="#6f8462" />
          <path d="M 40 110 C 42 92 56 88 60 92 C 54 102 46 106 40 110 Z" fill="#7f9472" />
          <circle cx="28" cy="88" r="4" fill="#df6b62" />
          <circle cx="52" cy="85" r="4.5" fill="#e8a84c" />
          <path d="M 62 113 L 78 113 L 75 126 L 65 126 Z" fill="#9d8371" stroke="#7a6251" strokeWidth="1.5" />
          <path d="M 70 113 C 65 100 55 98 52 102 C 58 108 65 110 70 113 Z" fill="#7f9472" />
          <path d="M 70 113 C 72 98 84 96 87 100 C 82 108 76 110 70 113 Z" fill="#6f8462" />
          <circle cx="70" cy="94" r="3.5" fill="#df6b62" />
          <path d="M 235 120 C 238 105 248 100 252 103 C 248 112 242 116 235 120 Z" fill="#7a906d" />
          <circle cx="248" cy="98" r="3.5" fill="#e8a84c" />
          <path d="M 220 125 C 224 112 232 108 235 111 C 232 118 226 122 220 125 Z" fill="#6c825f" />
          <line x1="10" y1="126" x2="275" y2="126" stroke="#9e8979" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <div className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)]">
          <section className="relative mt-6 flex min-h-[220px] items-center overflow-hidden rounded-[26px] border border-[#dce7ee] bg-[linear-gradient(118deg,#eaf3fa_0%,#f1f6f7_38%,#fbf6ef_78%,#fcf8f2_100%)] shadow-[0_8px_24px_#1240680d] max-[700px]:mt-4 max-[700px]:min-h-0 max-[700px]:rounded-[20px]" aria-labelledby="hero-heading">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[58%] bg-[url('/menu-hero.webp')] bg-cover bg-right [mask-image:linear-gradient(to_right,transparent_0%,black_28%)] max-[700px]:w-full max-[700px]:opacity-[.22] max-[700px]:[mask-image:none]" aria-hidden="true" />
            <svg className="pointer-events-none absolute -bottom-1.5 -left-1.5 z-[1] h-[100px] w-[100px] opacity-70" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M 5 115 C 20 85 45 65 85 45" stroke="#768a68" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 85 45 C 95 35 110 32 115 35 C 112 45 105 55 85 45 Z" fill="#889c79" opacity="0.85" />
              <path d="M 68 53 C 78 40 92 38 98 42 C 94 52 86 58 68 53 Z" fill="#7c906d" opacity="0.85" />
              <path d="M 52 64 C 42 50 35 48 30 52 C 34 62 44 68 52 64 Z" fill="#8a9e7b" opacity="0.8" />
              <path d="M 38 78 C 26 65 18 64 14 69 C 19 79 30 83 38 78 Z" fill="#768a68" opacity="0.85" />
              <path d="M 50 72 C 62 60 75 60 80 65 C 75 75 65 78 50 72 Z" fill="#829673" opacity="0.8" />
            </svg>
            <div className="relative z-[2] max-w-[540px] px-10 py-[34px] max-[700px]:max-w-full max-[700px]:px-5 max-[700px]:py-6 [&_h1]:m-0 [&_h1]:text-[clamp(28px,3.6vw,44px)] [&_h1]:leading-[1.22] [&_h1]:font-black [&_h1]:tracking-[-.02em] [&_h1]:text-[#182838] max-[700px]:[&_h1]:text-[26px]">
              <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#cbdde9] bg-[#ffffffcc] px-3 py-1 text-[11px] font-bold tracking-[.02em] text-[#175685]">🍽️ สั่งอาหารออนไลน์</span>
              <div className="relative mb-0.5 inline-block">
                <h1 id="hero-heading">อิ่มจานโปรด</h1>
                <svg className="absolute -bottom-1.5 left-[8%] h-[11px] w-[84%]" viewBox="0 0 120 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M 5 8 Q 60 14 115 4" stroke="#c0392b" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <p className="mt-2.5 text-[clamp(14px,1.5vw,17px)] leading-[1.45] font-bold text-[#3d5064]">เลือกเมนูที่ชอบ แล้วเตรียมอิ่มได้เลย</p>
              <p className="mt-1 text-xs font-medium text-[#6d7f93]">สั่งสะดวก รวดเร็ว ไม่ต้องยืนรอคิวหน้าร้าน</p>
            </div>
          </section>
        </div>
        <Suspense fallback={<MenuLoading />}><MenuContent searchParams={searchParams} /></Suspense>
      </main>
      <footer className="border-t border-[var(--border)] py-[22px] text-center text-xs text-[#96a4b6]"><div className="mx-auto w-[min(calc(100%-48px),1216px)] max-[700px]:w-[calc(100%-32px)]">©2026 อิ่มจานโปรด</div></footer>
    </>
  );
}
