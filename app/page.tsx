import Image from "next/image";
import Link from "next/link";
import { BrowserWindow } from "./_components/BrowserWindow";

export default function Home() {
  return (
    <BrowserWindow title="새로고침">
      <div className="flex flex-col items-center gap-8">
        <Image
          src="/rewind.png"
          alt=""
          aria-hidden="true"
          width={100}
          height={100}
          className="h-20 w-20"
        />

        <h1 className="text-center text-3xl font-bold leading-snug text-[#503836]">
          새로고침
          <br />
          하시겠습니까?
        </h1>

        <Link
          href="/folders"
          className="rounded-md bg-[#503836] px-10 py-2 text-base font-semibold text-white transition-colors hover:bg-[#3d2a28]"
        >
          네
        </Link>
      </div>
    </BrowserWindow>
  );
}
