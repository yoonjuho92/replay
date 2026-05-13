"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveAnswers } from "../actions";
import {
  type CategoryConfig,
  createEmptyAnswers,
  isAllFilled,
} from "../../categories";
import { LoadingOverlay } from "./LoadingOverlay";

type Props = {
  folderId: string;
  category: CategoryConfig;
  initialAnswers: Record<string, string>;
};

export function MemoryForm({
  folderId,
  category,
  initialAnswers,
}: Props) {
  const TOTAL = category.questions.length;
  const startStep = (() => {
    for (let i = 0; i < category.questions.length; i++) {
      const q = category.questions[i];
      if (!(initialAnswers[q.field] ?? "").trim()) return i + 1;
    }
    return TOTAL;
  })();

  const [step, setStep] = useState(startStep);
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({
    ...createEmptyAnswers(category),
    ...initialAnswers,
  }));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const question = category.questions[step - 1];
  const isLastStep = step === TOTAL;
  const previousGroupTitle =
    step > 1 ? category.questions[step - 2].groupTitle : undefined;
  const showGroupTitle =
    question.groupTitle && question.groupTitle !== previousGroupTitle;

  const updateField = (field: string, next: string) => {
    setAnswers((prev) => ({ ...prev, [field]: next }));
  };

  const handleNext = async () => {
    setError(null);
    saveAnswers(folderId, answers).catch(() => {});
    if (!isLastStep) {
      setStep(step + 1);
      return;
    }

    if (!isAllFilled(category, answers)) {
      setError("아직 비어 있는 항목이 있어요. 이전 항목을 확인해 주세요.");
      return;
    }

    setIsLoading(true);
    const res = await saveAnswers(folderId, answers);
    if (res.error) {
      setError(res.error);
      setIsLoading(false);
      return;
    }
    router.push(`/folders/${folderId}/write`);
  };

  const handlePrev = () => {
    setError(null);
    saveAnswers(folderId, answers).catch(() => {});
    if (step > 1) setStep(step - 1);
  };

  return (
    <>
      {isLoading && <LoadingOverlay message="글쓰기 화면으로 이동 중입니다..." />}
      <div
        key={step}
        className="flex w-full flex-col gap-4 text-[#503836] animate-[pageEnter_400ms_ease-out_both]"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-[#5DBFA8]">
            {step} / {TOTAL}
          </p>
          <Link
            href={`/folders/${folderId}/agent`}
            className="text-sm font-bold text-[#00A796] transition-opacity hover:opacity-80"
          >
            에이전트와 대화하기 →
          </Link>
        </div>
        {showGroupTitle && (
          <p className="text-sm font-bold text-[#503836]/70">
            {question.groupTitle}
          </p>
        )}
        <h2 className="text-lg font-bold">{question.question}</h2>
        {question.example && (
          <p className="text-sm text-[#503836]/70">예시: {question.example}</p>
        )}
        <textarea
          value={answers[question.field] ?? ""}
          onChange={(event) => updateField(question.field, event.target.value)}
          rows={3}
          className="w-full resize-y rounded border-2 border-[#CCE7D7] bg-white px-4 py-3 text-[0.9375rem] leading-relaxed text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none"
          placeholder="자유롭게 답해 주세요."
          autoFocus
        />
        {error && <p className="text-sm text-[#B0413E]">{error}</p>}
        <div className="flex justify-between gap-2">
          {step === 1 ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={handlePrev}
              className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA]"
            >
              이전
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={isLoading}
            className="rounded-md bg-[#503836] px-10 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
          >
            {isLastStep ? "글쓰기로" : "다음"}
          </button>
        </div>
      </div>
    </>
  );
}
