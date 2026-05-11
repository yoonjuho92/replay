"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  type CategoryConfig,
  filledFields,
  formatAnswersForPrompt,
  getCategoryByName,
  isAllFilled,
  normalizeAnswers,
  remainingFields,
} from "../categories";

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentChatResult = {
  messages: AgentMessage[];
  complete: boolean;
  error: string | null;
};

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function buildToolset(
  category: CategoryConfig,
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "save_inputs",
        description:
          "사용자가 알려준 정보를 저장합니다. 새로 알게 된 필드만 포함하세요. 빈 문자열은 보내지 마세요. 이 도구는 한 항목에 대한 대화가 충분히 무르익은 뒤(공감·후속 질문으로 1~2번 더 주고받은 뒤), 다음 항목으로 자연스럽게 넘어가는 메시지와 함께 호출하세요.",
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            category.questions.map((q) => [
              q.field,
              { type: "string", description: q.shortLabel },
            ]),
          ),
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mark_complete",
        description:
          "모든 항목이 채워졌고, 사용자에게 마무리 인사를 한 다음 호출하세요. 호출하면 다음 단계(글쓰기 페이지)로 자동으로 넘어갑니다.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
  ];
}

function buildSystemPrompt(
  category: CategoryConfig,
  saved: Record<string, string>,
  folderName: string,
): string {
  const filled = filledFields(category, saved);
  const remaining = remainingFields(category, saved);

  const filledBlock =
    filled.length === 0
      ? "(아직 없음)"
      : filled
          .map((q) => `- ${q.shortLabel} [${q.field}]: ${saved[q.field]}`)
          .join("\n");

  const remainingBlock =
    remaining.length === 0
      ? "(없음 — 모든 항목이 채워졌습니다)"
      : remaining
          .map((q) => `- ${q.shortLabel} [${q.field}]: "${q.question}"${q.example ? ` (예시: ${q.example})` : ""}`)
          .join("\n");

  const nextAction =
    remaining.length === 0
      ? [
          "[다음 행동 — 매우 중요]",
          "모든 항목이 채워졌습니다. 이번 답변에서 반드시 두 가지를 차례로 하세요:",
          "1) 사용자에게 짧고 따뜻한 마무리 인사 2~3문장 (예: '말해주셔서 고마워요. 당신의 기억이 잘 모이고 있어요. 이제 그 이야기를 글로 옮겨 볼게요.')",
          "2) 같은 턴에서 곧바로 mark_complete 도구를 호출. 호출하지 않으면 다음 단계로 넘어가지 않습니다.",
          "절대로 새 질문을 하지 마세요.",
        ].join("\n")
      : [
          "[다음 행동]",
          "아래 [아직 비어있는 항목] 목록을 참고하되, 지금 흐름에서 다뤄야 할 항목은 한 번에 하나입니다.",
          "이번 턴이 어떤 상황인지 먼저 판단하세요:",
          "(A) 직전에 한 질문에 사용자가 답했고, 그 답에 대해 더 듣고 싶은 결이 남았다면 → save_inputs를 호출하지 말고, 그 답에 대해 따뜻하게 공감하거나 호기심 어린 후속 질문 1개를 던지세요(예: '그 순간 어떤 마음이셨어요?', '그게 어떻게 느껴졌어요?'). 다음 항목으로 넘어가지 않습니다.",
          "(B) 같은 항목에 대해 이미 1~2번 더 주고받았고, 충분히 들었다는 느낌이 든다면 → 같은 턴에서 (1) 사용자의 이야기를 짧게 받아주는 한 문장 + (2) save_inputs 호출 + (3) [아직 비어있는 항목] 중 다음 항목 한 개를 자연스럽게 묻기 — 이 셋을 함께 하세요.",
          "절대 [이미 채워진 항목]을 다시 묻거나 확인하지 마세요. 한 답변은 4문장 이내로.",
        ].join("\n");

  return [
    `${category.agentPersona} 당신의 임무는 아래 항목을 모두 자연스러운 대화로 수집하고, 마지막에 mark_complete 도구를 호출해 다음 단계(글쓰기 페이지)로 사용자를 안내하는 것입니다.`,
    "",
    `폴더 이름: ${folderName}`,
    "",
    "[이미 채워진 항목 — 절대 다시 묻지 마세요]",
    filledBlock,
    "",
    "[아직 비어있는 항목 — 이 중에서만 한 번에 하나씩 물어보세요]",
    remainingBlock,
    "",
    "[대화의 결 — 가장 중요]",
    "사용자가 답을 주면 절대로 그 즉시 다음 질문으로 넘어가지 마세요. 그 답을 충분히 들어주는 것이 먼저입니다.",
    "한 항목당 흐름은 보통 이렇습니다:",
    "  1) 질문 →",
    "  2) 사용자 답변 →",
    "  3) 당신이 그 답에 짧게 공감/반응하고, 자연스러운 후속 질문 1개를 던짐(save_inputs 호출하지 않음) →",
    "  4) 사용자가 한 번 더 답변 →",
    "  5) 당신이 받아주는 한 문장 + save_inputs 호출 + 다음 항목 질문(같은 턴).",
    "사용자가 이미 단답으로 충분히 풀어낸 답을 줬다면, 1번의 후속 질문 정도로 짧게 마무리하고 다음 항목으로 넘어가도 좋습니다. 길게 하고 싶어 한다면 더 들어주세요.",
    "",
    "[필수 규칙]",
    "1. 새 질문은 반드시 [아직 비어있는 항목] 목록 안에서만 고르고, 한 메시지에는 새 항목 질문을 하나만 넣으세요(같은 항목에 대한 후속 질문은 예외).",
    "2. 질문 문구는 위 목록에 적힌 문장을 그대로 읽지 마세요. 사용자가 지금까지 들려준 답변의 결·어휘·분위기·호흡에 자연스럽게 이어지도록 매번 표현을 새로 빚어내 물어보세요. 묻고자 하는 핵심(어떤 정보를 얻을지)은 [아직 비어있는 항목]에 명시된 그대로 유지하되, 말투와 도입은 그 사용자만의 흐름에 맞춰 다르게 합니다. 예) 사용자가 격식 있는 어휘를 쓰면 격식 있게, 단답으로 답하면 부드럽게 풀어서, 감정을 깊이 꺼내면 그 결을 받아 한 톤 낮춰서.",
    "3. save_inputs를 호출할 때는 사용자가 실제로 말한 표현을 자연스러운 한 문장으로 정리해 보내세요. 사용자가 명시하지 않은 내용은 절대 만들어 넣지 마세요.",
    '4. 빈 문자열("")은 절대 보내지 마세요. 의미 있는 값이 있는 필드만 포함합니다.',
    '5. 사용자가 "모르겠다 / 기억 안 난다"고 답하면 한 번 더 부드럽게 단서를 끌어내 보고, 두 번째에도 모른다고 하면 "기억나지 않음"으로 저장하고 다음 항목으로 넘어가세요.',
    "6. 친근하고 담백한 한국어로, 한 답변은 4문장을 넘지 마세요.",
    "7. 모든 항목이 채워지면 그 즉시 같은 답변에서 (a) 짧은 마무리 인사 2~3문장 (b) mark_complete 도구 호출 — 둘 다 해주세요.",
    "8. 마크다운 강조 표기를 절대 쓰지 마세요. **굵게**, *기울임*, __강조__, 같은 기호로 단어를 감싸지 말고, 모든 답변은 평문 한국어로만 작성합니다. 별표(*, **)는 출력하지 마세요.",
    "9. 답변은 반드시 한국어로만 합니다. 영어 단어·문장·구두점(따옴표 외)·번역어 표기를 섞지 마세요. 외래어가 꼭 필요하면 한글로 음차해서 적습니다(예: 'agent' → '에이전트').",
    "",
    nextAction,
  ].join("\n");
}

async function persistAnswers(
  folderId: string,
  category: CategoryConfig,
  current: Record<string, string>,
  partial: Record<string, unknown>,
): Promise<Record<string, string>> {
  const next: Record<string, string> = { ...current };
  for (const q of category.questions) {
    const val = partial[q.field];
    if (typeof val === "string" && val.trim().length > 0) {
      next[q.field] = val.trim();
    }
  }
  const supabase = await createClient();
  await supabase
    .from("folders")
    .update({
      memory_inputs: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId);
  return next;
}

async function loadFolderState(folderId: string): Promise<{
  name: string;
  category: CategoryConfig;
  inputs: Record<string, string>;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("name, memory_inputs")
    .eq("id", folderId)
    .maybeSingle();
  if (!data) return null;
  const category = getCategoryByName(data.name);
  if (!category) return null;
  const inputs = normalizeAnswers(
    category,
    (data.memory_inputs ?? {}) as Record<string, unknown>,
  );
  return { name: data.name, category, inputs };
}

export async function chatWithAgent(
  folderId: string,
  prevMessages: AgentMessage[],
  userMessage: string,
): Promise<AgentChatResult> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      messages: prevMessages,
      complete: false,
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
    return {
      messages: prevMessages,
      complete: false,
      error: "폴더를 찾지 못했어요.",
    };
  }

  const tools = buildToolset(folder.category);
  let currentInputs = folder.inputs;
  let complete = false;

  type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
  const oaiMessages: OAIMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(folder.category, currentInputs, folder.name),
    },
    ...prevMessages.map(
      (m) => ({ role: m.role, content: m.content }) as OAIMessage,
    ),
    { role: "user", content: userMessage },
  ];

  const visibleMessages: AgentMessage[] = [
    ...prevMessages,
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < 6; i++) {
    oaiMessages[0] = {
      role: "system",
      content: buildSystemPrompt(folder.category, currentInputs, folder.name),
    };

    const allFilledNow = isAllFilled(folder.category, currentInputs);
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: oaiMessages,
      tools,
      tool_choice: allFilledNow
        ? { type: "function", function: { name: "mark_complete" } }
        : "auto",
    });

    const msg = completion.choices[0]?.message;
    if (!msg) break;
    oaiMessages.push(msg);

    if (msg.content && msg.content.trim().length > 0) {
      visibleMessages.push({
        role: "assistant",
        content: msg.content.trim(),
      });
    }

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      break;
    }

    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== "function") continue;
      const name = toolCall.function.name;
      let toolResponse: object = { ok: true };

      if (name === "save_inputs") {
        try {
          const args = JSON.parse(
            toolCall.function.arguments || "{}",
          ) as Record<string, unknown>;
          currentInputs = await persistAnswers(
            folderId,
            folder.category,
            currentInputs,
            args,
          );
          const filled = filledFields(folder.category, currentInputs);
          const remaining = remainingFields(folder.category, currentInputs);
          toolResponse = {
            saved: true,
            filled_count: filled.length,
            remaining_fields: remaining.map((q) => q.shortLabel),
          };
        } catch (e) {
          toolResponse = {
            saved: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      } else if (name === "mark_complete") {
        if (isAllFilled(folder.category, currentInputs)) {
          complete = true;
          toolResponse = { complete: true };
        } else {
          const remaining = remainingFields(folder.category, currentInputs).map(
            (q) => q.shortLabel,
          );
          toolResponse = {
            complete: false,
            error: "아직 미입력 항목이 남아 있습니다.",
            remaining_fields: remaining,
          };
        }
      } else {
        toolResponse = { error: `Unknown tool: ${name}` };
      }

      oaiMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResponse),
      });
    }

    if (complete) break;
  }

  if (!complete && isAllFilled(folder.category, currentInputs)) {
    complete = true;
  }

  revalidatePath(`/folders/${folderId}`);
  return {
    messages: visibleMessages,
    complete,
    error: null,
  };
}

function buildWritingCoachPrompt(
  category: CategoryConfig,
  folderName: string,
  answers: Record<string, string>,
  currentDraft: string,
): string {
  return [
    `${category.writingCoachPersona}`,
    "당신의 임무는 사용자가 자신의 손으로 직접 글을 쓰도록 옆에서 돕는 것입니다. 당신이 사용자의 글을 대신 쓰지 마세요. 대신, 첫 문장 함께 빚기 → 한 문단씩 함께 풀어가기 → 문장 다듬기 제안 → 톤·구조 조언 같은 식으로 옆에서 도와주세요. 사용자의 답변과 지금까지 쓴 draft만이 사실 정보의 출처입니다.",
    "",
    `폴더 이름: ${folderName}`,
    "",
    "사용자의 답변(글의 재료):",
    formatAnswersForPrompt(category, answers),
    "",
    "사용자가 지금 왼쪽 텍스트 박스에 쓰고 있는 글(빈 문자열일 수 있음):",
    "<draft>",
    currentDraft || "(아직 비어 있음)",
    "</draft>",
    "",
    "[첫 메시지 규칙 — 매우 중요]",
    "대화 이력에 system 메시지로 [세션 시작] 이라는 신호가 들어오면(다른 사용자 발화가 아직 없으면), 당신이 먼저 인사를 건네며 아래 형식으로 첫 문장 테마 4가지를 제안하세요. 4가지 테마는 위 [사용자의 답변]에 실제로 등장한 단서(반복된 습관, 마음이 가장 무거웠던 장면, 늘 곁에 있던 물건/사람, 자주 들었던 말 등)에서 직접 길어내고, 없는 사실은 만들지 마세요. 예시 문장은 1인칭 과거형 한 문장(14~30자).",
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
    "2. 사용자가 어떤 부분을 도와달라고 하면, 사용자가 이미 말한 사실(위 답변과 draft) 안에서만 도와주세요. 새 사실을 만들지 않습니다.",
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
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content: buildWritingCoachPrompt(
            folder.category,
            folder.name,
            folder.inputs,
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
        folder.inputs,
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
      model: "gpt-5.4-mini",
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
