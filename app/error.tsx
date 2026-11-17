"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-[70vh] flex-col items-center justify-center p-[30px] text-center [&_h1]:my-3 [&_h1]:text-[28px] [&_p]:text-[var(--muted)] [&_button]:mt-4 [&_button]:cursor-pointer [&_button]:rounded-xl [&_button]:border-0 [&_button]:bg-[var(--accent)] [&_button]:px-[25px] [&_button]:py-3 [&_button]:text-white"><p className="">อิ่มจานโปรด</p><h1>ยังโหลดเมนูไม่ได้</h1><p>ขออภัย ลองใหม่อีกครั้งในสักครู่นะ</p><button onClick={reset}>ลองอีกครั้ง</button></main>;
}
