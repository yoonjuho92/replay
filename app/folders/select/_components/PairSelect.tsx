"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { TOPIC_PAIRS } from "../../categories";
import { selectPairAction, type SelectPairState } from "../actions";

const initialState: SelectPairState = { error: null };

export function PairSelect() {
  const [state, formAction] = useActionState(selectPairAction, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-wrap items-stretch justify-center gap-6">
        {TOPIC_PAIRS.map((pair) => (
          <PairCard key={pair.id} id={pair.id} label={pair.label} />
        ))}
      </div>
      {state.error && (
        <p className="text-sm text-[#B0413E]">{state.error}</p>
      )}
    </form>
  );
}

function PairCard({ id, label }: { id: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="pairId"
      value={id}
      disabled={pending}
      className="flex h-32 w-48 flex-col items-center justify-center gap-2 rounded-md border-2 border-[#503836] bg-white text-[#503836] shadow-[4px_4px_0_#503836] transition-transform hover:-translate-y-1 hover:bg-[#FCF7B0] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-lg font-bold">{label}</span>
      {pending && (
        <span className="text-xs text-[#503836]/60">폴더 만드는 중...</span>
      )}
    </button>
  );
}
