"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthFormState } from "../login/actions";
import { signupAction } from "../signup/actions";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function SignupForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    signupAction,
    { error: null },
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoError(null);
    if (!file) {
      setPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoError("이미지 파일만 올릴 수 있어요.");
      e.target.value = "";
      setPreview(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("8MB 이하 이미지로 올려 주세요.");
      e.target.value = "";
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

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

      <label className="flex flex-col gap-1 text-sm font-bold">
        비밀번호
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="rounded border border-[#CCE7D7] bg-white px-3 py-2 text-base font-normal"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-bold">
        비밀번호 확인
        <input
          type="password"
          name="password_confirm"
          required
          minLength={6}
          autoComplete="new-password"
          className="rounded border border-[#CCE7D7] bg-white px-3 py-2 text-base font-normal"
        />
      </label>

      <div className="flex flex-col gap-2 text-sm font-bold">
        <span>내 사진</span>
        <p className="text-xs font-normal text-[#503836]/70">
          나중에 그림 속 얼굴을 만들 때 이 사진을 참고해요. 정면 얼굴이 잘
          보이는 사진을 골라 주세요.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border-2 border-[#503836] bg-white px-3 py-2 text-sm font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA]"
          >
            사진 고르기
          </button>
          {preview ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="선택한 사진"
                className="h-14 w-14 rounded-full border-2 border-[#CCE7D7] object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  setPreview(null);
                }}
                className="text-xs font-bold text-[#503836]/70 underline"
              >
                지우기
              </button>
            </div>
          ) : (
            <span className="text-xs text-[#503836]/60">선택된 사진 없음</span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          name="photo"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {photoError && (
          <p className="text-xs font-normal text-[#B0413E]">{photoError}</p>
        )}
      </div>

      {state.error && <p className="text-sm text-[#B0413E]">{state.error}</p>}
      {state.info && <p className="text-sm text-[#1c7a3a]">{state.info}</p>}

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
      {pending ? "처리 중..." : "회원가입"}
    </button>
  );
}
