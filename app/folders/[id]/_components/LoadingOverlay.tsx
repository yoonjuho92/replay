import Image from "next/image";

export function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#503836]/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border-2 border-[#503836] bg-white shadow-[4px_4px_0_#503836]">
        <div className="relative flex h-9 items-center border-b-2 border-[#503836] bg-[#BADECB] px-4">
          <div className="flex gap-1.5">
            <span className="block h-2.5 w-2.5 rounded-full border border-[#503836] bg-[#F3A9C9]" />
            <span className="block h-2.5 w-2.5 rounded-full border border-[#503836] bg-[#FCF7B0]" />
            <span className="block h-2.5 w-2.5 rounded-full border border-[#503836] bg-[#CCE2A5]" />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-[#503836]">
            로딩 중...
          </span>
        </div>
        <div className="flex items-center gap-5 bg-white px-6 py-7">
          <RefreshIcon />
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-sm font-bold text-[#503836]">{message}</p>
            <PixelProgressBar />
          </div>
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <Image
      src="/rewind.png"
      alt=""
      width={56}
      height={56}
      className="h-14 w-14 shrink-0 animate-spin"
      aria-hidden
    />
  );
}

function PixelProgressBar() {
  const cells = 12;
  return (
    <div className="flex gap-0.75 rounded border-2 border-[#503836] bg-white p-0.75">
      {Array.from({ length: cells }).map((_, i) => (
        <span
          key={i}
          className="h-3 flex-1 animate-[loadingWave_1.6s_ease-in-out_infinite] bg-[#A897C2]"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}
