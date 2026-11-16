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
    <section className="menu-section" id="menu" aria-labelledby="categories-heading">
      <div className="container">
        <div className="menu-heading-wrap">
          <h2 className="categories-heading" id="categories-heading">เมนูทั้งหมด</h2>
          <svg className="menu-underline-curve" viewBox="0 0 100 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M 4 7 Q 45 13 96 4" stroke="#8b261e" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>
        <nav className="category-nav" aria-label="เลือกหมวดหมู่อาหาร">
          <Link href="/#menu" scroll={false} prefetch={false} className={categoryId === null ? "category-link active" : "category-link"} aria-current={categoryId === null ? "page" : undefined}>ทั้งหมด</Link>
          {categories.map((category) => <Link key={category.id} href={`/?category=${category.id}#menu`} scroll={false} prefetch={false} className={categoryId === category.id ? "category-link active" : "category-link"} aria-current={categoryId === category.id ? "page" : undefined}>{category.name}</Link>)}
        </nav>
        <div className="content-layout">
          <div className="menu-list">
            <div className="results-heading" aria-live="polite"><h2>{selectedName ?? "รายการอาหารทั้งหมด"}</h2><span>แสดง {foods.length} รายการ</span></div>
            {foods.length === 0 ? <div className="empty-state"><p>ยังไม่มีเมนูในหมวดหมู่นี้</p><Link href="/#menu">ดูเมนูทั้งหมด</Link></div> : (
              <div className="food-grid">
                {foods.map((food) => (
                  <article className="food-card" key={food.id}>
                    <div className="food-photo"><FoodImage src={availableImage(food.imageUrl)} name={food.name} /><span className="food-category">{food.category.name}</span></div>
                    <div className="food-details">
                      <div>
                        <h3>{food.name}</h3>
                        {food.description ? <p className="food-description">{food.description}</p> : null}
                      </div>
                      <div className="food-card-bottom">
                        <p className="food-price">฿ {price.format(Number(food.price))}</p>
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
  return <section className="menu-section"><div className="container loading-state" role="status">กำลังโหลดเมนูอาหาร…</div></section>;
}

export default function Home({ searchParams }: { searchParams: MenuSearchParams }) {
  return (
    <>
      <SiteHeader active="customer" />
      <main className="main-wrapper">
        <svg className="decor-flower-left" viewBox="0 0 100 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M 0 20 Q 55 90 15 220" stroke="#798d6c" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 20 40 C 38 28 55 30 60 36 C 52 48 38 48 20 40 Z" fill="#7f9372" opacity="0.85" />
          <path d="M 32 68 C 50 56 68 62 72 70 C 60 80 46 78 32 68 Z" fill="#8ca07f" opacity="0.9" />
          <path d="M 22 85 C 6 68 4 52 8 48 C 20 54 24 72 22 85 Z" fill="#748867" opacity="0.8" />
          <path d="M 30 110 C 48 100 64 108 66 116 C 54 124 40 120 30 110 Z" fill="#829675" opacity="0.85" />
          <path d="M 22 130 C 6 115 5 100 10 95 C 20 102 24 118 22 130 Z" fill="#798d6c" opacity="0.8" />
          <path d="M 24 155 C 38 145 52 152 54 160 C 42 168 32 164 24 155 Z" fill="#8ca07f" opacity="0.85" />
          <path d="M 16 175 C 2 160 3 148 7 144 C 16 150 18 165 16 175 Z" fill="#748867" opacity="0.8" />
        </svg>

        <svg className="decor-garden-right-bottom" viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

        <div className="container">
          <section className="hero" aria-labelledby="hero-heading">
            <div className="hero-food-bg" aria-hidden="true" />
            <svg className="hero-leaf" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M 5 115 C 20 85 45 65 85 45" stroke="#768a68" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 85 45 C 95 35 110 32 115 35 C 112 45 105 55 85 45 Z" fill="#889c79" opacity="0.85" />
              <path d="M 68 53 C 78 40 92 38 98 42 C 94 52 86 58 68 53 Z" fill="#7c906d" opacity="0.85" />
              <path d="M 52 64 C 42 50 35 48 30 52 C 34 62 44 68 52 64 Z" fill="#8a9e7b" opacity="0.8" />
              <path d="M 38 78 C 26 65 18 64 14 69 C 19 79 30 83 38 78 Z" fill="#768a68" opacity="0.85" />
              <path d="M 50 72 C 62 60 75 60 80 65 C 75 75 65 78 50 72 Z" fill="#829673" opacity="0.8" />
            </svg>
            <div className="hero-content">
              <span className="hero-label">🍽️ สั่งอาหารออนไลน์</span>
              <div className="hero-title-wrap">
                <h1 id="hero-heading">อิ่มจานโปรด</h1>
                <svg className="hero-underline-curve" viewBox="0 0 120 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M 5 8 Q 60 14 115 4" stroke="#c0392b" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <p className="hero-subtitle">เลือกเมนูที่ชอบ แล้วเตรียมอิ่มได้เลย</p>
              <p className="hero-note">สั่งสะดวก รวดเร็ว ไม่ต้องยืนรอคิวหน้าร้าน</p>
            </div>
          </section>
        </div>
        <Suspense fallback={<MenuLoading />}><MenuContent searchParams={searchParams} /></Suspense>
      </main>
      <footer className="site-footer"><div className="container">อิ่มจานโปรด</div></footer>
    </>
  );
}
