"use server";

import { redirect } from "next/navigation";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { AGENT_MODEL } from "../prompts/models";
import { buildRecapGreetingPrompt } from "../prompts/interview";
import { buildWritingCoachPrompt } from "../prompts/writing-coach";
import { type AgentMessage, getOpenAI, loadFolderState } from "./agent-core";

function fallbackRecapGreeting(story: string): string {
  const brief =
    story.length > 140 ? `${story.slice(0, 140).trim()}…` : story.trim();
  return [
    "다시 만났어요. 지난번에 이런 이야기를 들려주셨죠.",
    `"${brief}"`,
    "이어서 더 들려주고 싶은 이야기가 있을까요? 충분하다면 위 '이야기 만들기'로 넘어가도 좋아요.",
  ].join("\n");
}

/**
 * 대화창의 첫 인사말. 저장된 이야기가 없으면 주제별 첫 질문으로 시작하고,
 * 이미 이야기가 있으면 그 내용을 짧게 요약해 되짚어 주며 이어가도록 안내한다.
 */
export async function generateChatOpener(folderId: string): Promise<string> {
  const folder = await loadFolderState(folderId);
  if (!folder) return "안녕하세요. 이야기를 함께 나눠 볼게요.";

  const { category, story } = folder;
  if (story.trim().length === 0) {
    return `안녕하세요. '${category.name}' 이야기를 천천히 함께 나눠 볼게요. ${category.opening}`;
  }

  const openai = getOpenAI();
  if (!openai) return fallbackRecapGreeting(story);

  try {
    const completion = await openai.chat.completions.create({
      model: AGENT_MODEL,
      messages: [
        {
          role: "system",
          content: buildRecapGreetingPrompt(category, story),
        },
        { role: "user", content: "[세션 시작]" },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return text || fallbackRecapGreeting(story);
  } catch {
    return fallbackRecapGreeting(story);
  }
}

export type WritingChatResult = {
  messages: AgentMessage[];
  error: string | null;
};

export async function generateCoachOpener(
  folderId: string,
): Promise<{ text: string; error: string | null }> {
  const openai = getOpenAI();
  if (!openai) {
    return { text: "", error: "OPENAI_API_KEY가 설정되지 않았어요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const folder = await loadFolderState(folderId);
  if (!folder) return { text: "", error: "폴더를 찾지 못했어요." };

  const { data } = await supabase
    .from("folders")
    .select("memory_generated")
    .eq("id", folderId)
    .maybeSingle();
  const currentDraft = ((data?.memory_generated as string | null) ?? "").trim();

  try {
    const completion = await openai.chat.completions.create({
      model: AGENT_MODEL,
      messages: [
        {
          role: "system",
          content: buildWritingCoachPrompt(
            folder.category,
            folder.name,
            folder.story,
            currentDraft,
          ),
        },
        { role: "system", content: "[세션 시작]" },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { text: "", error: "에이전트가 첫 인사를 만들지 못했어요." };
    return { text, error: null };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "에이전트 첫 인사 생성에 실패했어요.";
    return { text: "", error: message };
  }
}

export async function chatWithWritingCoach(
  folderId: string,
  prevMessages: AgentMessage[],
  userMessage: string,
  currentDraft: string,
): Promise<WritingChatResult> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      messages: prevMessages,
      error: "OPENAI_API_KEY가 설정되지 않았어요.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const folder = await loadFolderState(folderId);
  if (!folder) {
    return { messages: prevMessages, error: "폴더를 찾지 못했어요." };
  }

  type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
  const oaiMessages: OAIMessage[] = [
    {
      role: "system",
      content: buildWritingCoachPrompt(
        folder.category,
        folder.name,
        folder.story,
        currentDraft,
      ),
    },
    ...prevMessages.map(
      (m) => ({ role: m.role, content: m.content }) as OAIMessage,
    ),
    { role: "user", content: userMessage },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: AGENT_MODEL,
      messages: oaiMessages,
    });
    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      return {
        messages: [...prevMessages, { role: "user", content: userMessage }],
        error: "에이전트가 답변을 만들지 못했어요.",
      };
    }

    return {
      messages: [
        ...prevMessages,
        { role: "user", content: userMessage },
        { role: "assistant", content: reply },
      ],
      error: null,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "에이전트 응답을 가져오지 못했어요.";
    return {
      messages: [...prevMessages, { role: "user", content: userMessage }],
      error: message,
    };
  }
}
