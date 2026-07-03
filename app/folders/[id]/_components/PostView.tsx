"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  IMAGE_STYLES,
  type ImageStyle,
} from "../../categories";
import { generateSceneImage, planFinalize } from "../post-actions";
import type { Scene } from "../../prompts/image";

type Props = {
  folderId: string;
  folderName: string;
  draft: string;
  scenes: Scene[];
  initialUrls: (string | null)[];
  initialStyle: ImageStyle;
};

type SlotState = {
  url: string | null;
  error: string | null;
  regenerating?: boolean;
};

export function PostView({
  folderId,
  folderName,
  draft,
  scenes,
  initialUrls,
  initialStyle,
}: Props) {
  const [slots, setSlots] = useState<SlotState[]>(() =>
    scenes.map((_, i) => ({
      url: initialUrls[i] ?? null,
      error: null,
    })),
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [pickedStyle, setPickedStyle] = useState<ImageStyle>(initialStyle);
  const [downloading, setDownloading] = useState(false);
  const requestKeyRef = useRef("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  function handleGenerate(style: ImageStyle) {
    if (generating) return;
    setGenError(null);
    setGenerating(true);
    planFinalize(folderId, style).then((res) => {
      if (res.error) {
        setGenError(res.error);
        setGenerating(false);
        return;
      }
      router.refresh();
    });
  }

  // 서버에서 새 계획(장면/스타일/그림 유무)이 내려올 때마다, 아직 안 그려진 칸을 그린다.
  useEffect(() => {
    const key = `${initialStyle}|${scenes.map((s) => s.caption).join("~")}|${initialUrls
      .map((u) => (u ? 1 : 0))
      .join("")}`;
    if (requestKeyRef.current === key) return;
    requestKeyRef.current = key;
    setGenerating(false);
    setSlots(scenes.map((_, i) => ({ url: initialUrls[i] ?? null, error: null })));
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
  }, [folderId, scenes, initialUrls, initialStyle]);

  function regenerate(i: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[i] = { url: null, error: null, regenerating: true };
      return next;
    });
    generateSceneImage(folderId, i).then((res) => {
      setSlots((prev) => {
        const next = [...prev];
        next[i] = { url: res.url, error: res.error, regenerating: false };
        return next;
      });
    });
  }

  async function downloadAll() {
    if (downloading) return;
    setDownloading(true);
    try {
      for (let i = 0; i < slots.length; i++) {
        const url = slots[i]?.url;
        if (!url) continue;
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = `${folderName}-${i + 1}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objectUrl);
        } catch {
          // 한 장이 실패해도 나머지는 계속 시도한다.
        }
      }
    } finally {
      setDownloading(false);
    }
  }

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

  // 아직 그림 계획이 없을 때 — 스타일을 고르고 그림 그리기를 시작하는 화면.
  if (scenes.length === 0) {
    const hasDraft = draft.trim().length > 0;
    return (
      <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-5 rounded-md border-2 border-[#503836] bg-white p-6 text-[#503836] shadow-[4px_4px_0_#503836]">
        <p className="w-full whitespace-pre-wrap text-[0.9375rem] leading-relaxed">
          {draft || "아직 작성된 글이 없어요. 이야기 만들기에서 글을 먼저 적어 주세요."}
        </p>
        {hasDraft ? (
          <>
            <div className="flex w-full flex-col items-center gap-2">
              <p className="text-sm font-bold">어떤 그림체로 그릴까요?</p>
              <StylePicker
                value={pickedStyle}
                onChange={setPickedStyle}
                disabled={generating}
              />
            </div>
            {genError && <p className="text-sm text-[#B0413E]">{genError}</p>}
            <button
              type="button"
              onClick={() => handleGenerate(pickedStyle)}
              disabled={generating}
              className="rounded-md bg-[#503836] px-8 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
            >
              {generating
                ? "그림 그리는 중..."
                : "이 그림체로 3장 그리기"}
            </button>
          </>
        ) : (
          <Link
            href={`/folders/${folderId}/write`}
            className="rounded-md bg-[#503836] px-8 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28]"
          >
            이야기 만들기로 가기 →
          </Link>
        )}
      </div>
      </div>
    );
  }

  const allReady = slots.length > 0 && slots.every((s) => s?.url);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* 좌: 그림 / 우: 글 (전체는 스크롤하지 않고, 글이 길면 오른쪽 칸 안에서만 스크롤) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {/* 좌 — 그림 (이미지는 잘리지 않게 전체를 보여준다) */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded border-2 border-[#CCE7D7] bg-white">
          <div
            ref={scrollerRef}
            className="flex min-h-0 w-full flex-1 snap-x snap-mandatory overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {scenes.map((scene, i) => (
              <div
                key={i}
                className="relative flex h-full w-full shrink-0 snap-center items-center justify-center bg-[#F3F7FA]"
              >
                {slots[i]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slots[i].url ?? undefined}
                    alt={scene.caption}
                    className="h-full w-full object-contain"
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
                <button
                  type="button"
                  onClick={() => regenerate(i)}
                  disabled={slots[i]?.regenerating}
                  className="absolute left-3 top-3 rounded-full border-2 border-[#503836] bg-white/90 px-2 py-0.5 text-xs font-bold text-[#503836] transition-colors hover:bg-white disabled:opacity-60"
                >
                  {slots[i]?.regenerating ? "그리는 중..." : "다시 그리기"}
                </button>
              </div>
            ))}
          </div>

          {scenes.length > 1 && (
            <div className="flex shrink-0 justify-center gap-1.5 border-t-2 border-[#CCE7D7] bg-white py-2">
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

          <p className="shrink-0 border-t-2 border-[#CCE7D7] bg-white px-4 py-2 text-center text-xs font-bold text-[#5DBFA8]">
            {scenes[activeIdx]?.caption}
          </p>

          {/* 그림 아래 — 저장 버튼 (제목과 버튼 사이 구분선 없음) */}
          <div className="flex shrink-0 flex-col gap-3 bg-white p-4 pt-0">
            <button
              type="button"
              onClick={downloadAll}
              disabled={!allReady || downloading}
              className="rounded-md bg-[#503836] px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-50"
            >
              {downloading
                ? "내려받는 중..."
                : allReady
                  ? "그림 3장 모두 저장"
                  : "그림이 다 그려지면 저장할 수 있어요"}
            </button>
          </div>
        </div>

        {/* 우 — 글 */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded border-2 border-[#CCE7D7] bg-white p-4">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[#503836]">
              {draft || "(글이 비어 있어요)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StylePicker({
  value,
  onChange,
  disabled,
}: {
  value: ImageStyle;
  onChange: (style: ImageStyle) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {IMAGE_STYLES.map((style) => {
        const active = style.id === value;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id)}
            disabled={disabled}
            title={style.hint}
            className={`rounded-md border-2 border-[#503836] px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${
              active
                ? "bg-[#503836] text-white"
                : "bg-white text-[#503836] hover:bg-[#FCF7B0]"
            }`}
          >
            {style.label}
          </button>
        );
      })}
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
