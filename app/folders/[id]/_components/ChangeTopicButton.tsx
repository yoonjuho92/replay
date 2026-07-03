"use client";

import { useState, useTransition } from "react";
import { changeTopic } from "../actions";

type Props = {
  folderId: string;
  currentName: string;
  /** 바꿀 수 있는 다른 주제 이름들(이미 가진 주제는 제외) */
  options: string[];
};

export function ChangeTopicButton({ folderId, currentName, options }: Props) {
  // null = 닫힘, "pick" = 주제 고르기, 그 외 문자열 = 그 주제로 바꿀지 경고·확인
  const [phase, setPhase] = useState<null | "pick" | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (options.length === 0) return null;

  const close = () => {
    if (pending) return;
    setPhase(null);
    setError(null);
  };

  const confirmChange = (newName: string) => {
    setError(null);
    startTransition(async () => {
      const res = await changeTopic(folderId, newName);
      if (res.error) {
        setError(res.error);
        return;
      }
      // 주제가 바뀌면 이전 대화 화면 상태를 완전히 버리기 위해 새로 불러온다.
      window.location.reload();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase("pick")}
        className="rounded-md border-2 border-[#CCE7D7] bg-white px-3 py-1.5 text-sm font-bold text-[#503836] transition-opacity hover:opacity-70"
      >
        주제 바꾸기
      </button>

      {phase !== null && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-[#503836]/40 px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl border-2 border-[#CCE7D7] bg-white p-6 text-[#503836] shadow-[6px_6px_0_#503836]"
            onClick={(e) => e.stopPropagation()}
          >
            {phase === "pick" ? (
              <>
                <h2 className="text-lg font-bold">주제 바꾸기</h2>
                <p className="mt-2 text-sm leading-relaxed">
                  지금 주제는 ‘{currentName}’예요. 어떤 주제로 바꿀까요?
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {options.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPhase(name)}
                      className="rounded-md border-2 border-[#CCE7D7] bg-[#F3F7FA] px-4 py-2 text-sm font-bold text-[#503836] transition-opacity hover:opacity-70"
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className="text-sm font-bold text-[#503836] transition-opacity hover:opacity-70"
                  >
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-xl">
                    ⚠️
                  </span>
                  <h2 className="text-lg font-bold">잠깐, 확인해 주세요</h2>
                </div>
                <p className="mt-3 rounded-md border-2 border-[#F3A9C9] bg-[#FDEEF4] px-4 py-3 text-sm leading-relaxed">
                  ‘{currentName}’ 주제를 ‘{phase}’(으)로 바꾸면, 이 폴더에
                  저장된 이야기와 만든 글·그림이 모두 사라지고{" "}
                  <strong className="font-bold">되돌릴 수 없어요.</strong>
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  그래도 주제를 바꿀까요?
                </p>
                {error && (
                  <p className="mt-3 text-sm text-[#B0413E]">{error}</p>
                )}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (pending) return;
                      setPhase("pick");
                      setError(null);
                    }}
                    disabled={pending}
                    className="text-sm font-bold text-[#503836] transition-opacity hover:opacity-70 disabled:opacity-40"
                  >
                    뒤로
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmChange(phase)}
                    disabled={pending}
                    className="rounded-md bg-[#B0413E] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#8f3230] disabled:opacity-60"
                  >
                    {pending ? "바꾸는 중…" : "네, 지우고 바꿀게요"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
