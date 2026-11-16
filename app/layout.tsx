import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "เมนูอาหาร | อิ่มจานโปรด",
  description: "เลือกดูเมนูอาหารและราคาได้ง่าย ๆ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
