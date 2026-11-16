"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><p className="section-kicker">อิ่มจานโปรด</p><h1>ยังโหลดเมนูไม่ได้</h1><p>ขออภัย ลองใหม่อีกครั้งในสักครู่นะ</p><button onClick={reset}>ลองอีกครั้ง</button></main>;
}
