"use client";

import { useState } from "react";

export function FoodImage({ src, name }: { src: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== null && src !== failedSrc;
  return (
    <div className="food-image">
      {showImage ? (
        // Remote images may use different hosts; failures use the missing-image fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} loading="lazy" onError={() => setFailedSrc(src)} />
      ) : (
        <div className="food-placeholder" aria-label={`ยังไม่มีรูป ${name}`} role="img">
          <svg aria-hidden="true" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="33" r="21" stroke="currentColor" strokeWidth="1.4"/><circle cx="32" cy="33" r="15" stroke="currentColor" strokeWidth="1.4"/><path d="M9 8v12m-4-12v6c0 4 2 6 4 6s4-2 4-6V8M55 8v48M55 8c-5 5-6 13-3 18h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          <span>กำลังเตรียมรูปภาพ</span>
        </div>
      )}
    </div>
  );
}
