"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  NewFolderModal,
  type NewFolderInput,
} from "@/app/_components/NewFolderModal";
import { createFolder } from "../actions";

export type FolderRow = {
  id: string;
  name: string;
  memory_date: string | null;
};

const MAX_FOLDERS = 5;

function daysSince(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`);
  const diffMs = Date.now() - target.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function FoldersGrid({ folders }: { folders: FolderRow[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = (input: NewFolderInput) => {
    setError(null);
    startTransition(async () => {
      const res = await createFolder(input);
      if (res.error) setError(res.error);
    });
  };

  const canAdd = folders.length < MAX_FOLDERS;

  return (
    <>
      <div className="flex flex-wrap items-start justify-center gap-10">
        {folders.map((folder) => (
          <FolderItem key={folder.id} folder={folder} />
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={isPending}
            aria-label="폴더 추가"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl text-[#5DBFA8] shadow-md transition-transform hover:scale-105 disabled:opacity-60"
          >
            +
          </button>
        )}
      </div>
      {error && <p className="text-sm text-[#B0413E]">{error}</p>}
      {modalOpen && (
        <NewFolderModal
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function FolderItem({ folder }: { folder: FolderRow }) {
  const days = folder.memory_date ? daysSince(folder.memory_date) : null;
  return (
    <Link
      href={`/folders/${folder.id}`}
      className="flex flex-col items-center gap-3 transition-transform hover:scale-105"
    >
      <Image
        src="/folder.png"
        alt=""
        aria-hidden="true"
        width={105}
        height={81}
        className="h-16 w-auto"
      />
      <span className="text-sm font-medium text-[#503836]">{folder.name}</span>
      {days !== null && (
        <span className="text-sm font-bold text-[#5DBFA8]">
          {days.toLocaleString()} days
        </span>
      )}
    </Link>
  );
}
