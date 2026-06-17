"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MicButton } from "@/app/_components/MicButton";
import { saveDraft } from "../actions";
import { chatWithWritingCoach } from "../agent-actions";
import type { AgentMessage } from "../agent-core";

type Props = {
  folderId: string;
  initialDraft: string;
  initialGreeting: string;
};

const AUTOSAVE_DEBOUNCE_MS = 700;

export function WritingWorkspace({
  folderId,
  initialDraft,
  initialGreeting,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: "assistant", content: initialGreeting },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    saveTimerRef.current = setTimeout(async () => {
      const value = draftRef.current;
      if (value === lastSavedRef.current) return;
      const res = await saveDraft(folderId, value);
      if (!res.error) lastSavedRef.current = value;
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

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-4 text-[#503836]">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <textarea
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            placeholder="여기에 당신의 이야기를 직접 적어 보세요. 오른쪽 에이전트에게 물어보면서 함께 다듬어도 좋아요."
            className="flex-1 resize-none rounded border-2 border-[#CCE7D7] bg-white p-4 text-[0.9375rem] leading-relaxed text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none"
          />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
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
          {chatError && <p className="text-sm text-[#B0413E]">{chatError}</p>}
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
    </div>
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
