"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { chatWithAgent, type AgentMessage } from "../agent-actions";

type Props = {
  folderId: string;
  folderName: string;
  initialGreeting: string;
};

export function AgentChat({ folderId, folderName, initialGreeting }: Props) {
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: "assistant", content: initialGreeting },
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [completing, setCompleting] = useState(false);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!completing) return;
    const timer = setTimeout(() => {
      router.push(`/folders/${folderId}/write`);
    }, 2200);
    return () => clearTimeout(timer);
  }, [completing, folderId, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  const handleSend = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    setInput("");
    const optimistic: AgentMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(optimistic);
    startTransition(async () => {
      const res = await chatWithAgent(folderId, messages, text);
      if (res.error) {
        setError(res.error);
        return;
      }
      setMessages(res.messages);
      if (res.complete) {
        setCompleting(true);
      }
    });
  };

  if (completing) {
    return (
      <div className="relative flex h-full w-full flex-col gap-6 text-[#503836]">
        <h1 className="shrink-0 text-2xl font-bold leading-snug">
          <span className="text-[#5DBFA8]">{folderName}</span>
        </h1>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden text-center text-lg leading-loose">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 animate-[flashWhite_900ms_ease-out_both] bg-white"
          />
          <Image
            aria-hidden
            src="/rewind.png"
            alt=""
            width={160}
            height={160}
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 animate-[spinRewind_1600ms_ease-in-out_both]"
          />
          <p className="relative z-10 animate-[fadeUpBlur_900ms_ease-out_300ms_both]">
            이제 당신의 이야기를 글로 옮겨 볼게요.
          </p>
          <p className="relative z-10 animate-[fadeUpBlur_900ms_ease-out_1100ms_both]">
            글쓰기 화면으로 이동합니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-4 text-[#503836]">
      <h1 className="shrink-0 text-2xl font-bold leading-snug">
        <span className="text-[#5DBFA8]">{folderName}</span>
      </h1>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#5DBFA8]">에이전트와 대화하기</p>
        <Link
          href={`/folders/${folderId}`}
          className="text-sm font-bold text-[#00A796] transition-opacity hover:opacity-80"
        >
          직접 입력하기 →
        </Link>
      </div>
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
      {error && <p className="shrink-0 text-sm text-[#B0413E]">{error}</p>}
      <form onSubmit={handleSend} className="flex shrink-0 gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          className="flex-1 rounded border-2 border-[#CCE7D7] bg-white px-4 py-3 text-[15px] text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none disabled:opacity-60"
          placeholder="자유롭게 답해 주세요."
          autoFocus
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-md bg-[#503836] px-6 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28] disabled:opacity-60"
        >
          보내기
        </button>
      </form>
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
      className={`flex max-w-[85%] flex-col gap-1 ${isUser ? "self-end items-end" : "self-start items-start"}`}
    >
      <div
        className={`whitespace-pre-wrap rounded-2xl border-2 px-4 py-2 text-[15px] leading-relaxed ${
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
