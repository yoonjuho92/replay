import type { ReactNode } from "react";

type BrowserWindowProps = {
  title?: string;
  children: ReactNode;
};

export function BrowserWindow({
  title = "새로고침",
  children,
}: BrowserWindowProps) {
  return (
    <div className="w-full max-w-[80vw] overflow-hidden rounded-2xl border-2 border-[#CCE7D7] bg-[#BADECB] shadow-[6px_6px_0_#503836]">
      <div className="relative flex h-11 items-center border-b-2 border-[#CCE7D7] px-5">
        <div className="flex gap-2">
          <span className="block h-3 w-3 rounded-full border-2 border-[#CCE7D7] bg-[#F3A9C9]" />
          <span className="block h-3 w-3 rounded-full border-2 border-[#CCE7D7] bg-[#FCF7B0]" />
          <span className="block h-3 w-3 rounded-full border-2 border-[#CCE7D7] bg-[#CCE2A5]" />
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold text-[#503836]">
          {title}
        </span>
      </div>

      <div className="flex h-10 items-center gap-6 border-b-2 border-[#CCE7D7] px-5 text-[15px] text-[#503836]">
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

      <div className="flex h-[65vh] items-center justify-center bg-[#F3F7FA] px-8">
        {children}
      </div>

      <div className="h-8 border-t-2 border-[#CCE7D7]" />
    </div>
  );
}
