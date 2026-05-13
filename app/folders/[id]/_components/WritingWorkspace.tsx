"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { MicButton } from "@/app/_components/MicButton";
import { saveDraft } from "../actions";
import {
  chatWithWritingCoach,
  type AgentMessage,
} from "../agent-actions";
import { planFinalize } from "../post-actions";
import { LoadingOverlay } from "./LoadingOverlay";

type Props = {
  folderId: string;
  initialDraft: string;
  initialGreeting: string;
  hasExistingImage: boolean;
  existingImageDraft: string | null;
};

const AUTOSAVE_DEBOUNCE_MS = 700;

export function WritingWorkspace({
  folderId,
  initialDraft,
  initialGreeting,
  hasExistingImage,
  existingImageDraft,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: "assistant", content: initialGreeting },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const router = useRouter();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef(draft);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialDraft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  const scheduleAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      const value = draftRef.current;
      if (value === lastSavedRef.current) {
        setSaveStatus("saved");
        return;
      }
      const res = await saveDraft(folderId, value);
      if (!res.error) {
        lastSavedRef.current = value;
        setSaveStatus("saved");
      } else {
        setSaveStatus("idle");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [folderId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleDraftChange = (next: string) => {
    setDraft(next);
    scheduleAutosave();
  };

  const handleSendChat = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text || pending) return;
    setChatError(null);
    setChatInput("");
    const optimistic: AgentMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(optimistic);
    startTransition(async () => {
      const res = await chatWithWritingCoach(
        folderId,
        messages,
        text,
        draftRef.current,
      );
      if (res.error) {
        setChatError(res.error);
        return;
      }
      setMessages(res.messages);
    });
  };

  const trimmedDraft = draft.trim();
  const isUpToDate =
    hasExistingImage &&
    existingImageDraft !== null &&
    existingImageDraft.trim() === trimmedDraft &&
    trimmedDraft.length > 0;

  const handleFinalize = async () => {
    if (!trimmedDraft) {
      setFinalizeError("아직 글이 비어 있어요. 한 줄이라도 적어 주세요.");
      return;
    }
    setFinalizeError(null);

    if (isUpToDate) {
      router.push(`/folders/${folderId}/post`);
      return;
    }

    setFinalizing(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const saveRes = await saveDraft(folderId, draft);
    if (saveRes.error) {
      setFinalizeError(saveRes.error);
      setFinalizing(false);
      return;
    }
    lastSavedRef.current = draft;
    const res = await planFinalize(folderId);
    if (res.error) {
      setFinalizeError(res.error);
      setFinalizing(false);
      return;
    }
    router.push(`/folders/${folderId}/post`);
  };

  const saveStatusLabel =
    saveStatus === "saving"
      ? "저장 중..."
      : saveStatus === "saved"
      ? "저장됨"
      : "";

  return (
    <>
      {finalizing && !isUpToDate && (
        <LoadingOverlay message="어떤 장면을 그릴지 고르고 있어요..." />
      )}
      <div className="flex h-full w-full min-h-0 flex-col gap-4 text-[#503836]">
        <div className="flex shrink-0 items-center justify-end gap-3">
          <span className="text-xs text-[#503836]/60">{saveStatusLabel}</span>
          <Link
            href={`/folders/${folderId}`}
            className="text-sm font-bold text-[#00A796] transition-opacity hover:opacity-80"
          >
            ← 질문 다시 보기
          </Link>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-2">
            <p className="text-sm font-bold text-[#503836]">내가 쓰는 글</p>
            <textarea
              value={draft}
              onChange={(event) => handleDraftChange(event.target.value)}
              placeholder="여기에 당신의 이야기를 직접 적어 보세요. 오른쪽 에이전트에게 물어보면서 함께 다듬어도 좋아요."
              className="flex-1 resize-none rounded border-2 border-[#CCE7D7] bg-white p-4 text-[0.9375rem] leading-relaxed text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none"
            />
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            <p className="text-sm font-bold text-[#5DBFA8]">
              글쓰기 도움 에이전트
            </p>
            <div
              ref={scrollRef}
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded border-2 border-[#CCE7D7] bg-white p-4"
            >
              {messages.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} />
              ))}
              {pending && (
                <div className="flex gap-1 self-start rounded-2xl border-2 border-[#CCE7D7] bg-[#F3F7FA] px-4 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:300ms]" />
                </div>
              )}
            </div>
            {chatError && (
              <p className="text-sm text-[#B0413E]">{chatError}</p>
            )}
            <form onSubmit={handleSendChat} className="flex items-stretch gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={pending}
                className="flex-1 rounded border-2 border-[#CCE7D7] bg-white px-3 py-2 text-[0.9375rem] text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none disabled:opacity-60"
                placeholder="에이전트에게 물어보세요"
              />
              <MicButton
                disabled={pending}
                onTranscript={(text) =>
                  setChatInput((prev) => (prev ? `${prev} ${text}` : text))
                }
              />
              <button
                type="submit"
                disabled={pending || !chatInput.trim()}
                className="rounded-md bg-[#503836] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
              >
                보내기
              </button>
            </form>
          </div>
        </div>
        {finalizeError && (
          <p className="shrink-0 text-sm text-[#B0413E]">{finalizeError}</p>
        )}
        <div className="flex shrink-0 items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleFinalize}
            disabled={finalizing || pending}
            className="inline-flex items-center gap-2 rounded-md bg-[#503836] px-8 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
          >
            <Image
              src="/rewind.png"
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px]"
              aria-hidden
            />
            {isUpToDate ? "결과물 확인하기" : "완료하기"}
          </button>
        </div>
      </div>
    </>
  );
}

function ChatBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div
      className={`flex max-w-[88%] flex-col gap-1 ${isUser ? "self-end items-end" : "self-start items-start"}`}
    >
      <div
        className={`whitespace-pre-wrap rounded-2xl border-2 px-4 py-2 text-[0.875rem] leading-relaxed ${
          isUser
            ? "border-[#503836] bg-[#503836] text-white"
            : "border-[#CCE7D7] bg-[#F3F7FA] text-[#503836]"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
