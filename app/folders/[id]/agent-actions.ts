"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { generateNarrative, saveMemory } from "./actions";
import {
  EMPTY_INPUT,
  INPUT_FIELDS,
  INPUT_LABELS,
  type MemoryInput,
} from "./inputs";

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

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "save_inputs",
      description:
        "사용자가 알려준 정보를 한 번에 저장합니다. 새로 알게 된 필드만 포함하면 됩니다. 빈 문자열은 보내지 마세요.",
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          INPUT_FIELDS.map((key) => [
            key,
            { type: "string", description: INPUT_LABELS[key] },
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
        "12가지 정보가 모두 채워졌고, 사용자에게 마무리 인사를 한 다음 호출하세요. 회고문과 선택지가 자동으로 생성되고 다음 페이지로 넘어갑니다.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

function buildSystemPrompt(
  saved: MemoryInput,
  folder: { name: string; memoryDate: string | null },
): string {
  const filledKeys = INPUT_FIELDS.filter(
    (k) => (saved[k] ?? "").trim().length > 0,
  );
  const remainingKeys = INPUT_FIELDS.filter(
    (k) => (saved[k] ?? "").trim().length === 0,
  );

  const filledBlock =
    filledKeys.length === 0
      ? "(아직 없음)"
      : filledKeys
          .map((k) => `- ${INPUT_LABELS[k]} [${k}]: ${saved[k]}`)
          .join("\n");

  const remainingBlock =
    remainingKeys.length === 0
      ? "(없음 — 모든 항목이 채워졌습니다)"
      : remainingKeys
          .map((k) => `- ${INPUT_LABELS[k]} [${k}]`)
          .join("\n");

  const nextAction =
    remainingKeys.length === 0
      ? [
          "[다음 행동 — 매우 중요]",
          "모든 12개 항목이 채워졌습니다. 이번 답변에서 반드시 두 가지를 차례로 하세요:",
          "1) 사용자에게 짧고 따뜻한 마무리 인사 2~3문장(예: '말해주셔서 고마워요. 그날의 풍경이 잘 모이고 있어요. 이제 그 순간으로 돌아가 다른 선택지를 살펴볼게요.')",
          "2) 같은 턴에서 곧바로 mark_complete 도구를 호출. 호출하지 않으면 다음 단계로 넘어가지 않습니다.",
          "절대로 새 질문을 하지 마세요.",
        ].join("\n")
      : [
          "[다음 행동]",
          "아래 [아직 비어있는 항목] 목록 중에서 사용자의 흐름에 가장 어울리는 1~2개만 자연스럽게 물어보세요. 절대 [이미 채워진 항목]에 있는 내용을 다시 묻지 마세요. 한 메시지는 3~4문장 안으로.",
        ].join("\n");

  return [
    "당신은 사용자의 후회되는 과거 기억을 따뜻하고 진솔한 대화로 풀어내는 동행자입니다. 당신의 임무는 12개 항목을 모두 수집하고, 마지막에 mark_complete 도구를 호출해 다음 단계(선택지 페이지)로 사용자를 안내하는 것입니다.",
    "",
    `폴더 이름(사건의 주제): ${folder.name}`,
    `사건이 일어난 날짜: ${folder.memoryDate ?? "기록되지 않음"}`,
    "",
    "[이미 채워진 항목 — 절대 다시 묻지 마세요]",
    filledBlock,
    "",
    "[아직 비어있는 항목 — 이 중에서만 물어보세요]",
    remainingBlock,
    "",
    "[필수 규칙 — 반드시 지키세요]",
    "1. 새 질문은 반드시 [아직 비어있는 항목] 목록 안에서만 고르세요. [이미 채워진 항목]을 다시 묻거나 확인하지 마세요. 사용자가 그 내용을 다시 언급하지 않는 한 그것에 대해 다시 질문하지 마세요.",
    "2. 사용자의 답변에서 새로운 정보가 보이면 즉시 save_inputs 도구를 호출해 저장합니다. 한 답변에 여러 항목이 함께 등장했다면 한 번의 save_inputs 호출에 묶어서 보내세요.",
    "3. save_inputs의 인자 값은 사용자가 직접 말한 표현을 자연스러운 한 문장으로 정리해 보내세요(불필요한 수식 없이). 사용자가 명시하지 않은 내용은 절대 만들어 넣지 마세요.",
    '4. 빈 문자열("")은 절대 보내지 마세요. 의미 있는 값이 있는 필드만 포함합니다.',
    '5. 사용자가 "모르겠다 / 기억 안 난다"고 답하면 한 번 더 부드럽게 단서를 끌어내 보세요(예: 어렴풋이 떠오르는 색이나 감각). 두 번째에도 모른다고 하면 "기억나지 않음"으로 저장하고 다음 항목으로 넘어가세요.',
    "6. 큰 그림 → 그날의 장면 순서로 진행하세요. 보통 regret → regret_reason → current_impact 순으로 자리잡은 뒤, 그다음 place / companion / activity / weather / sounds / clothes / inner_warning / companion_reaction / unsaid_words 순으로 자연스럽게 들어갑니다. (단, 이미 채워진 항목은 건너뛰세요.)",
    "7. 모든 12개 항목이 채워지면 그 즉시 같은 답변에서 (a) 짧은 마무리 인사 2~3문장 (b) mark_complete 도구 호출 — 둘 다 해주세요. 새 질문은 하지 않습니다.",
    "8. 친근하고 담백한 한국어로, 한 답변은 3~4문장을 넘지 마세요.",
    "",
    nextAction,
  ].join("\n");
}

async function loadFolderState(folderId: string): Promise<{
  name: string;
  memoryDate: string | null;
  inputs: MemoryInput;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("name, memory_date, memory_inputs")
    .eq("id", folderId)
    .maybeSingle();
  if (!data) return null;
  const saved = (data.memory_inputs ?? {}) as Partial<MemoryInput>;
  const inputs: MemoryInput = { ...EMPTY_INPUT };
  for (const key of INPUT_FIELDS) {
    inputs[key] = saved[key] ?? "";
  }
  return {
    name: data.name as string,
    memoryDate: data.memory_date as string | null,
    inputs,
  };
}

async function persistInputs(
  folderId: string,
  current: MemoryInput,
  partial: Partial<MemoryInput>,
): Promise<MemoryInput> {
  const next: MemoryInput = { ...current };
  for (const key of INPUT_FIELDS) {
    const val = partial[key];
    if (typeof val === "string" && val.trim().length > 0) {
      next[key] = val.trim();
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

function isAllFilled(inputs: MemoryInput): boolean {
  return INPUT_FIELDS.every((key) => (inputs[key] ?? "").trim().length > 0);
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

  let currentInputs = folder.inputs;
  let complete = false;

  type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
  const oaiMessages: OAIMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(currentInputs, {
        name: folder.name,
        memoryDate: folder.memoryDate,
      }),
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
    // Refresh the system prompt every iteration so the model always sees the latest state.
    oaiMessages[0] = {
      role: "system",
      content: buildSystemPrompt(currentInputs, {
        name: folder.name,
        memoryDate: folder.memoryDate,
      }),
    };

    const allFilledNow = isAllFilled(currentInputs);
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: oaiMessages,
      tools: TOOLS,
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
          ) as Partial<MemoryInput>;
          currentInputs = await persistInputs(
            folderId,
            currentInputs,
            args,
          );
          const filled = INPUT_FIELDS.filter(
            (k) => (currentInputs[k] ?? "").trim().length > 0,
          );
          const remaining = INPUT_FIELDS.filter(
            (k) => (currentInputs[k] ?? "").trim().length === 0,
          );
          toolResponse = {
            saved: true,
            filled_count: filled.length,
            remaining_fields: remaining.map((k) => INPUT_LABELS[k]),
          };
        } catch (e) {
          toolResponse = {
            saved: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      } else if (name === "mark_complete") {
        if (isAllFilled(currentInputs)) {
          const narrativeRes = await generateNarrative(
            folderId,
            currentInputs,
          );
          if (narrativeRes.error) {
            toolResponse = {
              complete: false,
              error: narrativeRes.error,
            };
          } else {
            const saveRes = await saveMemory(folderId, {
              ...currentInputs,
              generated: narrativeRes.text,
            });
            if (saveRes.error) {
              toolResponse = { complete: false, error: saveRes.error };
            } else {
              complete = true;
              toolResponse = { complete: true };
            }
          }
        } else {
          const remaining = INPUT_FIELDS.filter(
            (k) => (currentInputs[k] ?? "").trim().length === 0,
          ).map((k) => INPUT_LABELS[k]);
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

  // Safety net: if all 12 fields are filled but the model never called mark_complete,
  // run the finalize step ourselves so the user always advances.
  if (!complete && isAllFilled(currentInputs)) {
    const narrativeRes = await generateNarrative(folderId, currentInputs);
    if (!narrativeRes.error) {
      const saveRes = await saveMemory(folderId, {
        ...currentInputs,
        generated: narrativeRes.text,
      });
      if (!saveRes.error) {
        complete = true;
      }
    }
  }

  revalidatePath(`/folders/${folderId}`);
  return {
    messages: visibleMessages,
    complete,
    error: null,
  };
}
