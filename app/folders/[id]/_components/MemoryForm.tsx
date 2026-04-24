"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  generateAndSaveChoices,
  generateAndSaveStory,
  generateNarrative,
  saveMemory,
  saveMemoryChoices,
  selectChoice,
} from "../actions";
import {
  EMPTY_INPUT,
  INPUT_FIELDS,
  type InputField,
  type MemoryChoices,
  type MemoryInput,
  type MemorySave,
} from "../inputs";
import { LoadingOverlay } from "./LoadingOverlay";

const SECTION1: { field: InputField; question: string }[] = [
  { field: "regret", question: "내가 가장 후회하는 선택은 무엇인가요?" },
  { field: "regret_reason", question: "그 선택을 후회하는 이유는 무엇인가요?" },
  {
    field: "current_impact",
    question: "그 선택의 결과가 현재의 삶에 어떤 영향을 미쳤나요?",
  },
];

const SECTION2: { field: InputField; question: string }[] = [
  { field: "place", question: "나는 어디에 있나요?" },
  { field: "companion", question: "나는 누구와 함께 있나요?" },
  { field: "activity", question: "나는 무엇을 하고 있나요?" },
  { field: "weather", question: "그날의 날씨는 어땠나요?" },
  { field: "sounds", question: "주변에서는 어떤 소리가 들렸나요?" },
  { field: "clothes", question: "나는 어떤 옷을 입고 있었나요?" },
  {
    field: "inner_warning",
    question: "혹시 마음속에 들려오는 작은 경고음을 무시하진 않았나요?",
  },
  {
    field: "companion_reaction",
    question: "나와 함께 있었던 사람의 반응은 어땠나요?",
  },
  { field: "unsaid_words", question: "미처 하지 못한 말이 있나요?" },
];

const SECTION1_END = SECTION1.length; // 3
const INTERMEDIATE_STEP = SECTION1_END + 1; // 4
const TOTAL_STEPS = SECTION1.length + 1 + SECTION2.length; // 13
const TOTAL_QUESTIONS = SECTION1.length + SECTION2.length; // 12

function getStep(
  step: number,
):
  | { kind: "input"; field: InputField; question: string; displayIndex: number }
  | { kind: "intermediate" }
  | null {
  if (step >= 1 && step <= SECTION1_END) {
    const item = SECTION1[step - 1];
    return { kind: "input", ...item, displayIndex: step };
  }
  if (step === INTERMEDIATE_STEP) {
    return { kind: "intermediate" };
  }
  if (step > INTERMEDIATE_STEP && step <= TOTAL_STEPS) {
    const item = SECTION2[step - INTERMEDIATE_STEP - 1];
    return {
      kind: "input",
      ...item,
      displayIndex: step - 1,
    };
  }
  return null;
}

type Phase = "input" | "review" | "choices" | "refresh";

type Props = {
  folderId: string;
  folderName: string;
  days: number | null;
  initial: MemorySave;
  initialChoices: MemoryChoices | null;
};

function FolderHeading({
  folderName,
  days,
}: {
  folderName: string;
  days: number | null;
}) {
  return (
    <h1 className="text-2xl font-bold leading-snug">
      <span className="text-[#5DBFA8]">{folderName}</span>
      <span className="text-[#503836]">
        {" "}
        으로부터 {days === null ? "날짜 모름" : `${days.toLocaleString()}일째…`}
      </span>
    </h1>
  );
}

export function MemoryForm({
  folderId,
  folderName,
  days,
  initial,
  initialChoices,
}: Props) {
  const [phase, setPhase] = useState<Phase>("input");
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<MemoryInput>(() => {
    const next: MemoryInput = { ...EMPTY_INPUT };
    for (const key of INPUT_FIELDS) {
      next[key] = initial[key] ?? "";
    }
    return next;
  });
  const [generated, setGenerated] = useState(initial.generated);
  const [savedGenerated, setSavedGenerated] = useState(
    initial.generated.trim().length > 0,
  );
  const [memoryChoices, setMemoryChoices] = useState<MemoryChoices | null>(
    initialChoices,
  );
  const [narrative, setNarrative] = useState(() => {
    if (initialChoices && initialChoices.selected !== null) {
      return initialChoices.items[initialChoices.selected]?.narrative ?? "";
    }
    return "";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  const stepConfig = getStep(step);
  const hasChoices = (memoryChoices?.items.length ?? 0) === 3;

  const updateField = (field: InputField, next: string) => {
    setAnswers((prev) => ({ ...prev, [field]: next }));
  };

  const handleInputNext = async () => {
    setError(null);
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    if (savedGenerated) {
      setPhase("review");
      return;
    }
    setIsLoading(true);
    const res = await generateNarrative(answers);
    if (res.error) {
      setError(res.error);
      setIsLoading(false);
      return;
    }
    const saveRes = await saveMemory(folderId, {
      ...answers,
      generated: res.text,
    });
    if (saveRes.error) {
      setError(saveRes.error);
      setIsLoading(false);
      return;
    }
    setGenerated(res.text);
    setSavedGenerated(true);
    setIsLoading(false);
    setPhase("review");
  };

  const handleInputPrev = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleReviewBack = () => {
    setError(null);
    setPhase("input");
    setStep(TOTAL_STEPS);
  };

  const handleReviewRegenerate = async () => {
    setError(null);
    setIsLoading(true);
    const res = await generateNarrative(answers);
    if (res.error) {
      setError(res.error);
      setIsLoading(false);
      return;
    }
    const saveRes = await saveMemory(folderId, {
      ...answers,
      generated: res.text,
    });
    if (saveRes.error) {
      setError(saveRes.error);
      setIsLoading(false);
      return;
    }
    setGenerated(res.text);
    setSavedGenerated(true);
    setIsLoading(false);
  };

  const handleReviewNext = async () => {
    setError(null);
    if (hasChoices) {
      setPhase("choices");
      return;
    }
    setIsLoading(true);
    const res = await generateAndSaveChoices(folderId, {
      ...answers,
      generated,
    });
    if (res.error || !res.choices) {
      setError(res.error ?? "선택지를 만들지 못했어요.");
      setIsLoading(false);
      return;
    }
    setMemoryChoices(res.choices);
    setIsLoading(false);
    setPhase("choices");
  };

  const handleChoicesBack = () => {
    setError(null);
    setPhase("review");
  };

  const handleChoicesRegenerate = async () => {
    setError(null);
    setIsLoading(true);
    const res = await generateAndSaveChoices(folderId, {
      ...answers,
      generated,
    });
    if (res.error || !res.choices) {
      setError(res.error ?? "선택지를 만들지 못했어요.");
      setIsLoading(false);
      return;
    }
    setMemoryChoices(res.choices);
    setNarrative("");
    setIsLoading(false);
  };

  const handleSelectChoice = async (index: number) => {
    if (!memoryChoices) return;
    setError(null);
    const item = memoryChoices.items[index];
    if (!item) return;

    if (item.narrative) {
      setIsLoading(true);
      const res = await selectChoice(folderId, memoryChoices, index);
      if (res.error || !res.choices) {
        setError(res.error ?? "선택을 저장하지 못했어요.");
        setIsLoading(false);
        return;
      }
      setMemoryChoices(res.choices);
      setNarrative(res.choices.items[index]?.narrative ?? "");
      setIsLoading(false);
      setPhase("refresh");
      return;
    }

    setIsLoading(true);
    const res = await generateAndSaveStory(folderId, {
      generated,
      choices: memoryChoices,
      selectedIndex: index,
    });
    if (res.error || !res.choices) {
      setError(res.error ?? "이야기를 만들지 못했어요.");
      setIsLoading(false);
      return;
    }
    setMemoryChoices(res.choices);
    setNarrative(res.choices.items[index]?.narrative ?? "");
    setIsLoading(false);
    setPhase("refresh");
  };

  const handleRefreshBack = () => {
    setError(null);
    setPhase("choices");
  };

  const handleRefreshSave = () => {
    if (!memoryChoices || memoryChoices.selected === null) return;
    const selectedIndex = memoryChoices.selected;
    setError(null);
    startSaving(async () => {
      const nextChoices: MemoryChoices = {
        ...memoryChoices,
        items: memoryChoices.items.map((item, i) =>
          i === selectedIndex ? { ...item, narrative } : item,
        ),
      };
      const choicesRes = await saveMemoryChoices(folderId, nextChoices);
      if (choicesRes.error) {
        setError(choicesRes.error);
        return;
      }
      const memoryRes = await saveMemory(folderId, { ...answers, generated });
      if (memoryRes.error) {
        setError(memoryRes.error);
        return;
      }
      setMemoryChoices(nextChoices);
      router.push("/folders");
    });
  };

  if (phase === "refresh") {
    return (
      <>
        {isLoading && <LoadingOverlay message="새로고침하는 중입니다..." />}
        <div className="flex w-full flex-col gap-4 text-[#503836]">
          <h2 className="text-lg font-bold leading-snug">
            당신은 과거의 어떤 선택을 어떻게 새로고침 하고싶나요?
            <br />
            과연 무엇이 바뀌게 될까요?
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold">새로고침 전</label>
              <textarea
                value={generated}
                readOnly
                rows={12}
                className="w-full resize-none rounded border-2 border-[#CCE7D7] bg-white p-4 text-[15px] leading-relaxed text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none"
                placeholder="없음"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#5DBFA8]">
                새로고침 후
              </label>
              <textarea
                value={narrative}
                onChange={(event) => setNarrative(event.target.value)}
                rows={12}
                className="w-full resize-none rounded border-2 border-[#CCE7D7] bg-white p-4 text-[15px] leading-relaxed text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none"
              />
            </div>
          </div>
          {error && <p className="text-sm text-[#B0413E]">{error}</p>}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={handleRefreshBack}
              disabled={isSaving || isLoading}
              className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA] disabled:opacity-60"
            >
              이전
            </button>
            <button
              type="button"
              onClick={handleRefreshSave}
              disabled={isSaving || isLoading}
              className="rounded-md bg-[#503836] px-10 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
            >
              {isSaving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (phase === "choices") {
    return (
      <>
        {isLoading && <LoadingOverlay message="새로고침하는 중입니다..." />}
        <div className="flex w-full flex-col gap-4 text-[#503836]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              어떤 선택으로 새로고침 할까요?
            </h2>
            <button
              type="button"
              onClick={handleChoicesRegenerate}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00A796] transition-opacity hover:opacity-80 disabled:opacity-60"
            >
              <Image
                src="/again.png"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4"
                aria-hidden
              />
              다시 생성하기
            </button>
          </div>
          <p className="text-sm text-[#503836]">
            원하는 선택을 클릭하면 그 선택을 했을 때의 이야기를 보여드려요.
          </p>
          <div className="flex flex-col gap-3">
            {memoryChoices?.items.map((item, index) => {
              const isSelected = memoryChoices.selected === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectChoice(index)}
                  disabled={isLoading}
                  className={`rounded-md border-2 p-4 text-left text-[15px] leading-relaxed transition-colors disabled:opacity-60 ${
                    isSelected
                      ? "border-[#5DBFA8] bg-[#E8F5EE]"
                      : "border-[#CCE7D7] bg-white hover:bg-[#F3F7FA]"
                  }`}
                >
                  <span className="mr-2 font-bold">{index + 1}.</span>
                  {item.text}
                </button>
              );
            })}
          </div>
          {error && <p className="text-sm text-[#B0413E]">{error}</p>}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={handleChoicesBack}
              disabled={isLoading}
              className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA] disabled:opacity-60"
            >
              이전
            </button>
          </div>
        </div>
      </>
    );
  }

  if (phase === "review") {
    return (
      <>
        {isLoading && <LoadingOverlay message="새로고침하는 중입니다..." />}
        <div className="flex w-full flex-col gap-4 text-[#503836]">
          <FolderHeading folderName={folderName} days={days} />
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              당신의 후회를 다시 적어 봤어요
            </h2>
            <button
              type="button"
              onClick={handleReviewRegenerate}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00A796] transition-opacity hover:opacity-80 disabled:opacity-60"
            >
              <Image
                src="/again.png"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4"
                aria-hidden
              />
              다시 생성하기
            </button>
          </div>
          <textarea
            value={generated}
            onChange={(event) => setGenerated(event.target.value)}
            rows={10}
            className="w-full resize-y rounded border-2 border-[#CCE7D7] bg-white p-4 text-[15px] leading-relaxed text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none"
            placeholder="내가 후회하는 일은..."
          />
          {error && <p className="text-sm text-[#B0413E]">{error}</p>}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={handleReviewBack}
              disabled={isLoading}
              className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA] disabled:opacity-60"
            >
              이전
            </button>
            <button
              type="button"
              onClick={handleReviewNext}
              disabled={isLoading}
              className="rounded-md bg-[#503836] px-10 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
            >
              {hasChoices ? "다음" : "새로고침하기"}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (stepConfig?.kind === "intermediate") {
    return (
      <>
        {isLoading && <LoadingOverlay message="새로고침하는 중입니다..." />}
        <div className="flex w-full flex-col gap-6 text-[#503836]">
          <FolderHeading folderName={folderName} days={days} />
          <div className="flex flex-col items-center gap-2 py-10 text-center text-lg leading-loose">
            <p>지금부터 과거로 돌아가 선택을 되돌리겠습니다.</p>
            <p>선택을 되돌리기에 앞서 그날의 순간을 자세히 기록해 보아요.</p>
          </div>
          {error && <p className="text-sm text-[#B0413E]">{error}</p>}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={handleInputPrev}
              className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA]"
            >
              이전
            </button>
            <button
              type="button"
              onClick={handleInputNext}
              className="rounded-md bg-[#503836] px-10 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28]"
            >
              다음
            </button>
          </div>
        </div>
      </>
    );
  }

  if (stepConfig?.kind === "input") {
    const { field, question, displayIndex } = stepConfig;
    const value = answers[field];
    const isLastStep = step === TOTAL_STEPS;
    return (
      <>
        {isLoading && <LoadingOverlay message="새로고침하는 중입니다..." />}
        <div className="flex w-full flex-col gap-4 text-[#503836]">
          <FolderHeading folderName={folderName} days={days} />
          <p className="text-sm font-bold text-[#5DBFA8]">
            {displayIndex} / {TOTAL_QUESTIONS}
          </p>
          <h2 className="text-lg font-bold">{question}</h2>
          <input
            type="text"
            value={value}
            onChange={(event) => updateField(field, event.target.value)}
            className="w-full rounded border-2 border-[#CCE7D7] bg-white px-4 py-3 text-[15px] text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none"
            placeholder="한 줄로 답해 주세요."
            autoFocus
          />
          {error && <p className="text-sm text-[#B0413E]">{error}</p>}
          <div className="flex justify-between gap-2">
            {step === 1 ? (
              <Link
                href="/folders"
                className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA]"
              >
                폴더로
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleInputPrev}
                className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA]"
              >
                이전
              </button>
            )}
            <button
              type="button"
              onClick={handleInputNext}
              disabled={isLoading}
              className="rounded-md bg-[#503836] px-10 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
            >
              {!isLastStep || savedGenerated ? "다음" : "확인하기"}
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}
