"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const FULL_STORAGE_KEY = "window-full";

type FolderTab = "chat" | "write" | "post";

type BrowserWindowProps = {
  title?: string;
  children: ReactNode;
  showSignOut?: boolean;
  showFoldersLink?: boolean;
  fill?: boolean;
  fullPage?: boolean;
  hideTitleBar?: boolean;
  folderId?: string;
  current?: FolderTab;
};

export function BrowserWindow({
  title = "새로고침",
  children,
  showSignOut = false,
  showFoldersLink = true,
  fill = false,
  fullPage = false,
  hideTitleBar = false,
  folderId,
  current,
}: BrowserWindowProps) {
  const [isFull, setIsFull] = useState(fullPage);

  // 페이지(탭)를 이동해도 전체화면 상태를 유지하기 위해 localStorage에 보존한다.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FULL_STORAGE_KEY);
      if (raw == null) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFull(raw === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggleFull() {
    setIsFull((v) => {
      const next = !v;
      try {
        localStorage.setItem(FULL_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const fillContent = fill || isFull;
  return (
    <div
      className={
        isFull
          ? "fixed inset-0 z-20 flex flex-col overflow-hidden bg-[#BADECB]"
          : "w-full max-w-[80vw] overflow-hidden rounded-2xl border-2 border-[#CCE7D7] bg-[#BADECB] shadow-[6px_6px_0_#503836]"
      }
    >
      {!hideTitleBar && !isFull && (
      <div className="relative flex h-11 shrink-0 items-center border-b-2 border-[#CCE7D7] px-5">
        <div className="flex gap-2">
          <span className="block h-3 w-3 rounded-full border-2 border-[#CCE7D7] bg-[#F3A9C9]" />
          <span className="block h-3 w-3 rounded-full border-2 border-[#CCE7D7] bg-[#FCF7B0]" />
          <span className="block h-3 w-3 rounded-full border-2 border-[#CCE7D7] bg-[#CCE2A5]" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-[0.9375rem] font-bold text-[#503836]">
          {title}
        </span>
        {showSignOut && (
          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/profile"
              className="text-sm font-bold text-[#503836] transition-opacity hover:opacity-70"
            >
              내 사진
            </Link>
            {showFoldersLink && (
              <Link
                href="/folders"
                className="text-sm font-bold text-[#503836] transition-opacity hover:opacity-70"
              >
                폴더로
              </Link>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm font-bold text-[#503836] transition-opacity hover:opacity-70"
              >
                로그아웃
              </button>
            </form>
          </div>
        )}
      </div>
      )}

      <div className="flex h-10 shrink-0 items-center gap-6 border-b-2 border-[#CCE7D7] px-5 text-[0.9375rem] text-[#503836]">
        {folderId ? (
          <>
            <FolderNavTab
              href={`/folders/${folderId}`}
              label="대화하기"
              active={current === "chat"}
            />
            <FolderNavTab
              href={`/folders/${folderId}/write`}
              label="이야기 만들기"
              active={current === "write"}
            />
            <FolderNavTab
              href={`/folders/${folderId}/post`}
              label="결과 보기"
              active={current === "post"}
            />
          </>
        ) : (
          <>
            <span>File</span>
            <span>Edit</span>
            <span>Object</span>
            <span>View</span>
          </>
        )}
        <button
          type="button"
          onClick={toggleFull}
          aria-label={isFull ? "부분화면으로" : "전체화면으로"}
          title={isFull ? "부분화면으로" : "전체화면으로"}
          className="ml-auto inline-flex h-5 w-5 items-center justify-center transition-opacity hover:opacity-60"
        >
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 transition-transform ${isFull ? "rotate-180" : ""}`}
            fill="none"
            stroke="#503836"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="5 8 10 13 15 8" />
          </svg>
        </button>
      </div>

      {fillContent ? (
        <div
          className={
            isFull
              ? "min-h-0 flex-1 bg-[#F3F7FA]"
              : "h-[65vh] bg-[#F3F7FA]"
          }
        >
          <div className="flex h-full flex-col px-8 py-8">{children}</div>
        </div>
      ) : (
        <div className="h-[65vh] overflow-y-auto bg-[#F3F7FA]">
          <div className="flex min-h-full flex-col items-center justify-center px-8 py-8">
            {children}
          </div>
        </div>
      )}

      <div className="h-8 shrink-0 border-t-2 border-[#CCE7D7]" />
    </div>
  );
}

function FolderNavTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "font-bold text-[#00A796]"
          : "text-[#503836] transition-opacity hover:opacity-70"
      }
    >
      {label}
    </Link>
  );
}
