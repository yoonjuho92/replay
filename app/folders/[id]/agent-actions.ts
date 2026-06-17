"use server";

import { redirect } from "next/navigation";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { type CategoryConfig, formatStoryForPrompt } from "../categories";
import {
  AGENT_MODEL,
  type AgentMessage,
  getOpenAI,
  loadFolderState,
} from "./agent-core";

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
          content: [
            category.agentPersona,
            `이 자서전 챕터의 주제: ${category.theme}`,
            "",
            "아래는 사용자가 이전 대화에서 들려준 이야기 요약입니다.",
            "<이야기>",
            story,
            "</이야기>",
            "",
            "이 사용자가 대화창에 다시 들어왔습니다. 아래를 담은 짧은 인사말 하나를 한국어 평문으로 작성하세요.",
            "1) '다시 만났어요' 같은 반가운 인사 한 마디.",
            "2) 지난번 이야기를 두세 문장으로 따뜻하게 되짚어 주기. 핵심만 짧게, 사용자가 실제로 말한 내용만 쓰고 없는 사실은 만들지 마세요.",
            "3) 더 들려주고 싶은 이야기가 있는지, 혹은 어느 대목을 이어가고 싶은지 자연스럽게 묻는 한 문장. 충분하다면 위 '이야기 만들기'로 넘어가도 좋다고 한 줄 덧붙이기.",
            "전체 4~5문장 이내. 마크다운·별표 금지, 한국어만.",
          ].join("\n"),
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

function buildWritingCoachPrompt(
  category: CategoryConfig,
  folderName: string,
  story: string,
  currentDraft: string,
): string {
  return [
    `${category.writingCoachPersona}`,
    "당신의 임무는 사용자가 자신의 손으로 직접 글을 쓰도록 옆에서 돕는 것입니다. 당신이 사용자의 글을 대신 쓰지 마세요. 대신, 첫 문장 함께 빚기 → 한 문단씩 함께 풀어가기 → 문장 다듬기 제안 → 톤·구조 조언 같은 식으로 옆에서 도와주세요. 사용자가 대화로 들려준 이야기와 지금까지 쓴 draft만이 사실 정보의 출처입니다.",
    "",
    `폴더(자서전 챕터) 이름: ${folderName}`,
    `이 챕터의 주제: ${category.theme}`,
    "",
    "사용자가 대화에서 들려준 이야기(글의 재료):",
    formatStoryForPrompt(story),
    "",
    "사용자가 지금 왼쪽 텍스트 박스에 쓰고 있는 글(빈 문자열일 수 있음):",
    "<draft>",
    currentDraft || "(아직 비어 있음)",
    "</draft>",
    "",
    "[첫 메시지 규칙 — 매우 중요]",
    "대화 이력에 system 메시지로 [세션 시작] 이라는 신호가 들어오면(다른 사용자 발화가 아직 없으면), 당신이 먼저 인사를 건네며 아래 형식으로 첫 문장 테마 4가지를 제안하세요. 4가지 테마는 위 [사용자가 대화에서 들려준 이야기]에 실제로 등장한 단서(반복된 습관, 마음이 가장 무거웠던 장면, 늘 곁에 있던 물건/사람, 자주 들었던 말 등)에서 직접 길어내고, 없는 사실은 만들지 마세요. 예시 문장은 1인칭 과거형 한 문장(14~30자).",
    "",
    "출력 형식(첫 메시지일 때만 이 형식 그대로):",
    "✍️ 당신의 이야기를 시작할 첫 문장을 만들어 드립니다",
    "가장 마음이 끌리는 주제를 하나 선택해 주세요. 번호를 말씀해 주시면 제가 관련 질문을 드릴게요!",
    "",
    "1. <테마 이름>",
    '예시: "<짧은 1인칭 첫 문장>"',
    "2. <테마 이름>",
    '예시: "<짧은 1인칭 첫 문장>"',
    "3. <테마 이름>",
    '예시: "<짧은 1인칭 첫 문장>"',
    "4. <테마 이름>",
    '예시: "<짧은 1인칭 첫 문장>"',
    "",
    "단, draft에 이미 내용이 있는 상태로 들어왔다면 위 4가지 제안 대신, 적어둔 글을 짧게 받아주고 '어디서부터 이어갈까요?' 하고 한 줄로 물어 시작하세요.",
    "",
    "[대화 규칙 — 첫 메시지 이후의 일반 대화]",
    "1. 사용자가 1~4 같은 숫자로 첫 문장 테마를 골랐다면, 그 테마에 맞춰 짧고 구체적인 후속 질문(한 문장)을 던져 첫 문장을 함께 빚어 주세요.",
    "2. 사용자가 어떤 부분을 도와달라고 하면, 사용자가 이미 말한 사실(위 이야기와 draft) 안에서만 도와주세요. 새 사실을 만들지 않습니다.",
    "3. 사용자의 글을 통째로 대신 써주지 마세요. 길어도 한 문단 분량의 예시까지, 보통은 한두 문장 단위로 보여 주세요.",
    "4. 사용자가 '문장 다듬어줘'처럼 부탁하면, 원문과 다듬은 문장 두 가지를 짧게 나란히 보여 주고, 어떤 결을 살렸는지 한 줄 코멘트.",
    "5. 친근하고 담백한 한국어. 한 답변은 5문장 이내, 핵심만.",
    "6. 마크다운 강조 표기를 절대 쓰지 마세요. **굵게**, *기울임*, __강조__, 같은 기호로 단어를 감싸지 말고, 모든 답변은 평문 한국어로만 작성합니다. 별표(*, **)는 출력하지 마세요.",
  ].join("\n");
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
