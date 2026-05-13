import Link from "next/link";
import type { ReactNode } from "react";

type BrowserWindowProps = {
  title?: string;
  children: ReactNode;
  showSignOut?: boolean;
  showFoldersLink?: boolean;
  fill?: boolean;
};

export function BrowserWindow({
  title = "새로고침",
  children,
  showSignOut = false,
  showFoldersLink = true,
  fill = false,
}: BrowserWindowProps) {
  return (
    <div className="w-full max-w-[80vw] overflow-hidden rounded-2xl border-2 border-[#CCE7D7] bg-[#BADECB] shadow-[6px_6px_0_#503836]">
      <div className="relative flex h-11 items-center border-b-2 border-[#CCE7D7] px-5">
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

      <div className="flex h-10 items-center gap-6 border-b-2 border-[#CCE7D7] px-5 text-[0.9375rem] text-[#503836]">
        <span>File</span>
        <span>Edit</span>
        <span>Object</span>
        <span>View</span>
        <span className="ml-auto inline-flex h-5 w-5 items-center justify-center">
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="#503836"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="5 8 10 13 15 8" />
          </svg>
        </span>
      </div>

      {fill ? (
        <div className="h-[65vh] bg-[#F3F7FA]">
          <div className="flex h-full flex-col px-8 py-8">{children}</div>
        </div>
      ) : (
        <div className="h-[65vh] overflow-y-auto bg-[#F3F7FA]">
          <div className="flex min-h-full flex-col items-center justify-center px-8 py-8">
            {children}
          </div>
        </div>
      )}

      <div className="h-8 border-t-2 border-[#CCE7D7]" />
    </div>
  );
}
