import type { NextRequest } from "next/server";
import type OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { hasStory } from "../../categories";
import { AGENT_MODEL } from "../../prompts/models";
import {
  buildInterviewSystemPrompt,
  buildInterviewToolset,
} from "../../prompts/interview";
import {
  type AgentMessage,
  getOpenAI,
  loadFolderState,
  persistStory,
} from "../agent-core";

export const runtime = "nodejs";

type Body = {
  messages: AgentMessage[];
  userMessage: string;
};

type ToolCallAccum = { id: string; name: string; args: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: folderId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const openai = getOpenAI();
  const folder = await loadFolderState(folderId);

  const body = (await req.json()) as Body;
  const prevMessages = Array.isArray(body.messages) ? body.messages : [];
  const userMessage = typeof body.userMessage === "string" ? body.userMessage : "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        if (!openai) {
          send({ type: "error", error: "OPENAI_API_KEY가 설정되지 않았어요." });
          return;
        }
        if (!folder) {
          send({ type: "error", error: "폴더를 찾지 못했어요." });
          return;
        }

        const tools = buildInterviewToolset();
        let currentStory = folder.story;
        let complete = false;

        type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
        const oaiMessages: OAIMessage[] = [
          {
            role: "system",
            content: buildInterviewSystemPrompt(
              folder.category,
              currentStory,
              folder.name,
            ),
          },
          ...prevMessages.map(
            (m) => ({ role: m.role, content: m.content }) as OAIMessage,
          ),
          { role: "user", content: userMessage },
        ];

        for (let i = 0; i < 6; i++) {
          oaiMessages[0] = {
            role: "system",
            content: buildInterviewSystemPrompt(
              folder.category,
              currentStory,
              folder.name,
            ),
          };

          const completion = await openai.chat.completions.create({
            model: AGENT_MODEL,
            messages: oaiMessages,
            tools,
            tool_choice: "auto",
            stream: true,
          });

          let content = "";
          const toolCalls: Record<number, ToolCallAccum> = {};

          for await (const chunk of completion) {
            const choice = chunk.choices[0];
            if (!choice) continue;
            const delta = choice.delta;
            if (delta?.content) {
              content += delta.content;
              send({ type: "delta", text: delta.content });
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const slot = (toolCalls[tc.index] ??= {
                  id: "",
                  name: "",
                  args: "",
                });
                if (tc.id) slot.id = tc.id;
                if (tc.function?.name) slot.name += tc.function.name;
                if (tc.function?.arguments) slot.args += tc.function.arguments;
              }
            }
          }

          const calls = Object.values(toolCalls);
          oaiMessages.push({
            role: "assistant",
            content: content || null,
            ...(calls.length > 0
              ? {
                  tool_calls: calls.map((t) => ({
                    id: t.id,
                    type: "function" as const,
                    function: { name: t.name, arguments: t.args },
                  })),
                }
              : {}),
          });

          if (calls.length === 0) break;

          for (const t of calls) {
            let toolResponse: object = { ok: true };
            if (t.name === "save_story") {
              try {
                const parsed = JSON.parse(t.args || "{}") as {
                  summary?: unknown;
                };
                const summary =
                  typeof parsed.summary === "string" ? parsed.summary : "";
                currentStory = await persistStory(folderId, summary);
                toolResponse = { saved: currentStory.length > 0 };
              } catch (e) {
                toolResponse = {
                  saved: false,
                  error: e instanceof Error ? e.message : String(e),
                };
              }
            } else if (t.name === "mark_complete") {
              if (hasStory(currentStory)) {
                complete = true;
                toolResponse = { complete: true };
              } else {
                toolResponse = {
                  complete: false,
                  error:
                    "아직 저장된 이야기가 없습니다. 먼저 save_story로 이야기를 저장하세요.",
                };
              }
            } else {
              toolResponse = { error: `Unknown tool: ${t.name}` };
            }
            oaiMessages.push({
              role: "tool",
              tool_call_id: t.id,
              content: JSON.stringify(toolResponse),
            });
          }

          if (complete) break;
        }

        send({ type: "done", complete });
      } catch (e) {
        send({
          type: "error",
          error: e instanceof Error ? e.message : "응답을 가져오지 못했어요.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
