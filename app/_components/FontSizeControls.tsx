"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "font-scale";
const BASE_PX = 19;
const MIN = 0.8;
const MAX = 1.6;
const STEP = 0.1;

function clamp(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(MAX, Math.max(MIN, Math.round(n * 100) / 100));
}

function applyScale(v: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${BASE_PX * v}px`;
  document.documentElement.style.setProperty("--font-scale", String(v));
}

export function FontSizeControls() {
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null) return;
      const next = clamp(parseFloat(raw));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScale(next);
      applyScale(next);
    } catch {
      // ignore
    }
  }, []);

  function apply(next: number) {
    const v = clamp(next);
    setScale(v);
    applyScale(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      // ignore
    }
  }

  const percent = Math.round(scale * 100);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border-2 border-[#503836] bg-white px-2 py-1 shadow-[3px_3px_0_#503836]">
      <button
        type="button"
        onClick={() => apply(scale - STEP)}
        disabled={scale <= MIN + 0.0001}
        aria-label="글자 크기 줄이기"
        className="flex h-8 w-8 items-center justify-center rounded-full text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA] disabled:opacity-40"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => apply(1)}
        aria-label="글자 크기 기본값"
        title={`${percent}%`}
        className="min-w-12 px-1 text-center text-xs font-bold text-[#503836] transition-colors hover:underline"
      >
        가 {percent}%
      </button>
      <button
        type="button"
        onClick={() => apply(scale + STEP)}
        disabled={scale >= MAX - 0.0001}
        aria-label="글자 크기 늘리기"
        className="flex h-8 w-8 items-center justify-center rounded-full text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA] disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
