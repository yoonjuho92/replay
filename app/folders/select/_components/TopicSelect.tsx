"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CATEGORIES,
  TOPIC_PICK_COUNT,
  type CategorySlug,
} from "../../categories";
import { selectTopicsAction, type SelectTopicsState } from "../actions";

const initialState: SelectTopicsState = { error: null };

export function TopicSelect() {
  const [state, formAction] = useActionState(selectTopicsAction, initialState);
  const [selected, setSelected] = useState<CategorySlug[]>([]);

  const toggle = (slug: CategorySlug) => {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      // 이미 정해진 개수만큼 골랐으면 더 고르지 못한다.
      if (prev.length >= TOPIC_PICK_COUNT) return prev;
      return [...prev, slug];
    });
  };

  const topics = CATEGORIES.filter((c) => c.available);
  const ready = selected.length === TOPIC_PICK_COUNT;

  return (
    <form action={formAction} className="flex w-full flex-col items-center gap-8">
      <div className="flex w-full flex-nowrap items-stretch justify-center gap-4 overflow-x-auto px-1 pt-3 pb-3">
        {topics.map((c) => {
          const isSelected = selected.includes(c.slug);
          const isFull = !isSelected && selected.length >= TOPIC_PICK_COUNT;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => toggle(c.slug)}
              disabled={isFull}
              aria-pressed={isSelected}
              className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-md border-2 border-[#503836] text-[#503836] shadow-[4px_4px_0_#503836] transition-transform hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "-translate-y-1 bg-[#FCF7B0]"
                  : "bg-white hover:bg-[#FCF7B0]"
              }`}
            >
              <span className="text-lg font-bold">{c.name}</span>
            </button>
          );
        })}
      </div>

      {selected.map((slug) => (
        <input key={slug} type="hidden" name="slug" value={slug} />
      ))}

      {state.error && <p className="text-sm text-[#B0413E]">{state.error}</p>}

      <StartButton ready={ready} count={selected.length} />
    </form>
  );
}

function StartButton({ ready, count }: { ready: boolean; count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!ready || pending}
      className="rounded-md bg-[#503836] px-8 py-3 text-base font-bold text-white shadow-[4px_4px_0_#CCE7D7] transition-colors hover:bg-[#3d2a28] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "폴더 만드는 중..."
        : ready
          ? "선택 완료"
          : `${count}/${TOPIC_PICK_COUNT} 선택`}
    </button>
  );
}
