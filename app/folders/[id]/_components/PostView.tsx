"use client";

import { useEffect, useRef, useState } from "react";
import { generateSceneImage, type Scene } from "../post-actions";

type Props = {
  folderId: string;
  folderName: string;
  draft: string;
  scenes: Scene[];
  initialUrls: (string | null)[];
};

type SlotState = {
  url: string | null;
  error: string | null;
};

export function PostView({
  folderId,
  folderName,
  draft,
  scenes,
  initialUrls,
}: Props) {
  const [slots, setSlots] = useState<SlotState[]>(() =>
    scenes.map((_, i) => ({
      url: initialUrls[i] ?? null,
      error: null,
    })),
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const startedRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    scenes.forEach((_, i) => {
      if (initialUrls[i]) return;
      generateSceneImage(folderId, i).then((res) => {
        setSlots((prev) => {
          const next = [...prev];
          next[i] = { url: res.url, error: res.error };
          return next;
        });
      });
    });
  }, [folderId, scenes, initialUrls]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const handler = () => {
      const w = el.clientWidth;
      if (w === 0) return;
      const i = Math.round(el.scrollLeft / w);
      setActiveIdx(Math.max(0, Math.min(scenes.length - 1, i)));
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [scenes.length]);

  if (scenes.length === 0) {
    return (
      <div className="flex w-full max-w-[460px] flex-col items-center gap-4 rounded-md border-2 border-[#503836] bg-white p-6 text-center text-[#503836] shadow-[4px_4px_0_#503836]">
        <p className="text-sm">아직 그릴 장면이 정해지지 않았어요.</p>
        <p className="text-xs text-[#503836]/60">
          글쓰기 화면에서 한 번 더 &lsquo;완료하기&rsquo;를 눌러 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-md border-2 border-[#503836] bg-white shadow-[4px_4px_0_#503836]">
      <div className="flex items-center gap-3 border-b-2 border-[#503836] bg-[#FCF7B0] px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#503836] bg-[#BADECB] text-base font-bold text-[#503836]">
          {folderName.slice(0, 1)}
        </div>
        <span className="text-sm font-bold text-[#503836]">{folderName}</span>
      </div>

      <div
        ref={scrollerRef}
        className="flex w-full snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {scenes.map((scene, i) => (
          <div
            key={i}
            className="relative aspect-square w-full shrink-0 snap-center bg-[#F3F7FA]"
          >
            {slots[i]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slots[i].url ?? undefined}
                alt={scene.caption}
                className="h-full w-full object-cover"
              />
            ) : slots[i]?.error ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-[#B0413E]">
                <span>이미지를 그리지 못했어요</span>
                <span className="text-xs text-[#503836]/60">
                  {slots[i].error}
                </span>
              </div>
            ) : (
              <SkeletonScene caption={scene.caption} />
            )}
            {scenes.length > 1 && (
              <span className="absolute right-3 top-3 rounded-full bg-[#503836]/80 px-2 py-0.5 text-xs font-bold text-white">
                {i + 1}/{scenes.length}
              </span>
            )}
          </div>
        ))}
      </div>

      {scenes.length > 1 && (
        <div className="flex justify-center gap-1.5 border-t-2 border-[#503836] bg-white py-2">
          {scenes.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === activeIdx ? "bg-[#503836]" : "bg-[#503836]/25"
              }`}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t-2 border-[#503836] bg-white p-4">
        <p className="text-xs font-bold text-[#5DBFA8]">
          {scenes[activeIdx]?.caption}
        </p>
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#503836]">
          {draft || "(글이 비어 있어요)"}
        </p>
      </div>
    </div>
  );
}

function SkeletonScene({ caption }: { caption: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#F3F7FA]">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:300ms]" />
      </div>
      <p className="px-6 text-center text-xs text-[#503836]/60">{caption}</p>
    </div>
  );
}
