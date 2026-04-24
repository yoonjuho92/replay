"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";

export type NewFolderInput = {
  name: string;
  date: { year: number; month: number; day: number } | null;
};

type Props = {
  onClose: () => void;
  onSave: (folder: NewFolderInput) => void;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR - 1950 + 1 },
  (_, i) => CURRENT_YEAR - i,
);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function NewFolderModal({ onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [year, setYear] = useState(2000);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [unknownDate, setUnknownDate] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      date: unknownDate ? null : { year, month, day },
    });
    onClose();
  };

  const selectClass =
    "rounded border border-[#CCE7D7] bg-white px-2 py-1 text-sm text-[#503836] disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[520px] overflow-hidden rounded-2xl bg-white shadow-[6px_6px_0_#503836]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-10 items-center justify-end bg-[#CCE7D7] px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-[#503836]"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-6 px-10 py-8"
        >
          <Image
            src="/folder.png"
            alt=""
            aria-hidden="true"
            width={105}
            height={81}
            className="h-16 w-auto"
          />

          <div className="grid w-full grid-cols-[auto_1fr] items-center gap-x-6 gap-y-4">
            <label
              htmlFor="folder-name"
              className="text-base font-bold text-[#503836]"
            >
              폴더 이름
            </label>
            <input
              id="folder-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="폴더 이름을 입력해 주세요"
              className="rounded border border-[#CCE7D7] bg-white px-3 py-2 text-sm text-[#503836] placeholder:text-[#A8B5AD]"
            />

            <span className="text-base font-bold text-[#503836]">날짜</span>
            <div className="flex items-center gap-2 text-sm text-[#503836]">
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                disabled={unknownDate}
                className={selectClass}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span>년</span>
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                disabled={unknownDate}
                className={selectClass}
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span>월</span>
              <select
                value={day}
                onChange={(event) => setDay(Number(event.target.value))}
                disabled={unknownDate}
                className={selectClass}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span>일</span>
            </div>
          </div>

          <label className="flex items-center gap-2 self-start pl-[88px] text-sm text-[#503836]">
            <input
              type="checkbox"
              checked={unknownDate}
              onChange={(event) => setUnknownDate(event.target.checked)}
              className="h-4 w-4 accent-[#503836]"
            />
            날짜 모름
          </label>

          <button
            type="submit"
            className="mt-2 w-full max-w-[200px] rounded-md bg-[#503836] px-10 py-3 text-base font-bold text-white transition-colors hover:bg-[#3d2a28]"
          >
            저장하기
          </button>
        </form>
      </div>
    </div>
  );
}
