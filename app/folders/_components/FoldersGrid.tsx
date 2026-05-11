"use client";

import Image from "next/image";
import Link from "next/link";

export type FolderRow = {
  id: string;
  name: string;
  available: boolean;
  isFinalized: boolean;
};

export function FoldersGrid({ folders }: { folders: FolderRow[] }) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-10">
      {folders.map((folder) => (
        <FolderItem key={folder.id} folder={folder} />
      ))}
    </div>
  );
}

function FolderItem({ folder }: { folder: FolderRow }) {
  const href = folder.isFinalized
    ? `/folders/${folder.id}/post`
    : `/folders/${folder.id}`;
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-3 transition-transform hover:scale-105"
    >
      <Image
        src="/folder.png"
        alt=""
        aria-hidden="true"
        width={105}
        height={81}
        className={`h-16 w-auto ${folder.available ? "" : "opacity-50"}`}
      />
      <span className="text-sm font-medium text-[#503836]">{folder.name}</span>
      {!folder.available && (
        <span className="text-xs font-bold text-[#503836]/60">준비 중</span>
      )}
    </Link>
  );
}
