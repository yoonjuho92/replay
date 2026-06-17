"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MicButton } from "@/app/_components/MicButton";
import type { AgentMessage } from "../agent-core";

type Props = {
  folderId: string;
  initialGreeting: string;
};

export function AgentChat({ folderId, initialGreeting }: Props) {
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: "assistant", content: initialGreeting },
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  const latestAssistant =
    [...messages].reverse().find((m) => m.role === "assistant")?.content ??
    initialGreeting;

  const handleSend = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    setInput("");
    const history = messages;
    setMessages([...history, { role: "user", content: text }]);
    startTransition(async () => {
      try {
        const res = await fetch(`/folders/${folderId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, userMessage: text }),
        });
        if (!res.ok || !res.body) {
          setError("응답을 가져오지 못했어요.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let started = false;

        const pump = async (): Promise<void> => {
          const { value, done } = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            const evt = JSON.parse(json) as {
              type: "delta" | "done" | "error";
              text?: string;
              complete?: boolean;
              error?: string;
            };
            if (evt.type === "delta") {
              acc += evt.text ?? "";
              setMessages((prev) => {
                if (!started) {
                  started = true;
                  return [...prev, { role: "assistant", content: acc }];
                }
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: acc };
                return next;
              });
            } else if (evt.type === "done") {
              if (evt.complete) setCompleted(true);
            } else if (evt.type === "error") {
              setError(evt.error ?? "응답을 가져오지 못했어요.");
            }
          }
          await pump();
        };
        await pump();
      } catch {
        setError("응답을 가져오지 못했어요.");
      }
    });
  };

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-4 text-[#503836]">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto px-2 py-6">
        <div className="w-full whitespace-pre-wrap rounded-2xl border-2 border-[#CCE7D7] bg-white px-5 py-4 text-left text-lg leading-relaxed text-[#503836] md:text-xl md:leading-relaxed">
          {latestAssistant}
        </div>
        {pending && (
          <div className="flex gap-1.5 self-start rounded-2xl border-2 border-[#CCE7D7] bg-[#F3F7FA] px-4 py-3">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#A8B5AD] [animation-delay:300ms]" />
          </div>
        )}
      </div>
      {completed && (
        <div className="flex shrink-0 flex-col items-center gap-2 rounded border-2 border-[#CCE7D7] bg-[#F3F7FA] px-4 py-3 text-center">
          <p className="text-sm text-[#503836]">
            이야기가 충분히 모였어요. 준비되면 글로 옮겨 볼까요? 더 들려주고
            싶은 이야기가 있다면 계속 이어가도 좋아요.
          </p>
          <Link
            href={`/folders/${folderId}/write`}
            className="rounded-md bg-[#503836] px-6 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28]"
          >
            이야기 만들기로 가기 →
          </Link>
        </div>
      )}
      {error && <p className="shrink-0 text-sm text-[#B0413E]">{error}</p>}
      <form onSubmit={handleSend} className="flex shrink-0 items-stretch gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          className="flex-1 rounded border-2 border-[#CCE7D7] bg-white px-4 py-3 text-[0.9375rem] text-[#503836] placeholder:text-[#A8B5AD] focus:outline-none disabled:opacity-60"
          placeholder="자유롭게 답해 주세요."
          autoFocus
        />
        <MicButton
          disabled={pending}
          onTranscript={(text) =>
            setInput((prev) => (prev ? `${prev} ${text}` : text))
          }
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
