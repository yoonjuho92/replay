"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteProfilePhotoAction,
  uploadProfilePhotoAction,
  type ProfilePhotoState,
} from "../actions";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

type Props = {
  initialPhotoUrl: string | null;
};

export function ProfilePhotoForm({ initialPhotoUrl }: Props) {
  const [state, formAction] = useActionState<ProfilePhotoState, FormData>(
    uploadProfilePhotoAction,
    { error: null, info: null },
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<ProfilePhotoState | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const shownUrl = preview ?? initialPhotoUrl;

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
    setPreview(URL.createObjectURL(file));
  }

  async function handleDelete() {
    if (!confirm("정말 사진을 지울까요?")) return;
    setDeleting(true);
    setDeleteResult(null);
    try {
      const res = await deleteProfilePhotoAction();
      setDeleteResult(res);
      if (!res.error) {
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-[#503836]">
      <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-2 border-[#CCE7D7] bg-white shadow-[3px_3px_0_#503836]">
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownUrl}
            alt="내 사진"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs text-[#503836]/60">사진 없음</span>
        )}
      </div>

      <form action={formAction} className="flex w-full flex-col items-center gap-3">
        <p className="text-center text-xs text-[#503836]/70">
          그림 속 얼굴을 만들 때 이 사진을 참고해요. 정면 얼굴이 잘 보이는
          사진을 골라 주세요.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          name="photo"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border-2 border-[#503836] bg-white px-4 py-2 text-sm font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA]"
          >
            사진 고르기
          </button>
          <SubmitButton />
          {initialPhotoUrl && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded border-2 border-[#B0413E] bg-white px-4 py-2 text-sm font-bold text-[#B0413E] transition-colors hover:bg-[#FCEAEA] disabled:opacity-60"
            >
              {deleting ? "지우는 중..." : "사진 지우기"}
            </button>
          )}
        </div>
        {photoError && (
          <p className="text-center text-sm text-[#B0413E]">{photoError}</p>
        )}
        {state.error && (
          <p className="text-center text-sm text-[#B0413E]">{state.error}</p>
        )}
        {state.info && (
          <p className="text-center text-sm text-[#1c7a3a]">{state.info}</p>
        )}
        {deleteResult?.error && (
          <p className="text-center text-sm text-[#B0413E]">
            {deleteResult.error}
          </p>
        )}
        {deleteResult?.info && (
          <p className="text-center text-sm text-[#1c7a3a]">
            {deleteResult.info}
          </p>
        )}
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[#503836] px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
    >
      {pending ? "저장 중..." : "저장"}
    </button>
  );
}
