"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthFormState } from "../../login/actions";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    { error: null },
  );

  return (
    <form
      action={formAction}
      className="flex w-full max-w-sm flex-col gap-4 text-[#503836]"
    >
      <label className="flex flex-col gap-1 text-sm font-bold">
        이메일
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded border border-[#CCE7D7] bg-white px-3 py-2 text-base font-normal"
        />
      </label>

      {state.error && <p className="text-sm text-[#B0413E]">{state.error}</p>}
      {state.info && <p className="text-sm text-[#00A796]">{state.info}</p>}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-[#503836] px-10 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
    >
      {pending ? "보내는 중..." : "재설정 링크 보내기"}
    </button>
  );
}
