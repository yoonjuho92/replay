import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  type CategoryConfig,
  getCategoryByName,
  getStory,
} from "../categories";

export const AGENT_MODEL = "gpt-5.4-mini";

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function buildToolset(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "save_story",
        description:
          "사용자가 지금까지 들려준 이야기를 평문 한국어로 요약해 저장합니다. 새 내용을 들을 때마다 호출하되, 항상 '지금까지의 전체 이야기'를 하나의 자연스러운 글로 다시 정리해서 통째로 보내세요(이전 저장본을 덮어씁니다). 사용자가 실제로 말한 내용만 담고, 없는 사실은 만들지 마세요.",
        parameters: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description:
                "지금까지 사용자가 들려준 이야기를 담은 평문 요약(전체본).",
            },
          },
          required: ["summary"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mark_complete",
        description:
          "이야기가 한 편의 글로 옮기기에 충분히 모였고, 사용자에게 마무리 인사를 한 다음 호출하세요. 호출하면 사용자에게 '이야기 만들기'로 넘어갈 수 있는 버튼이 나타납니다(자동으로 넘어가지 않으며, 사용자가 직접 눌러 이동합니다).",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
  ];
}

export function buildSystemPrompt(
  category: CategoryConfig,
  story: string,
  folderName: string,
): string {
  const storyBlock =
    story.trim().length > 0 ? story.trim() : "(아직 없음 — 첫 대화입니다)";

  return [
    `${category.agentPersona} 당신의 임무는 사용자의 자서전 한 챕터를 쓰기 위한 이야기를, 정해진 항목을 채우는 식이 아니라 자유롭고 따뜻한 대화로 끌어내는 것입니다.`,
    "",
    `폴더(자서전 챕터) 이름: ${folderName}`,
    `이 챕터의 주제: ${category.theme}`,
    "",
    "[이 주제에서 함께 더듬어 갈 결]",
    category.interviewGuide,
    "",
    "[지금까지 모인 이야기 — 사용자가 들려준 내용]",
    storyBlock,
    "",
    "[대화의 결 — 가장 중요]",
    "이것은 설문이 아니라 자서전을 위한 인터뷰입니다. 미리 정해진 질문 목록을 차례로 읽지 마세요. 사용자가 방금 들려준 이야기에서 가장 마음이 가는 한 지점을 골라, 그 결을 따라 한 번에 하나씩 자연스럽게 물어보세요.",
    "사용자가 답을 주면 곧바로 다음 질문으로 넘어가지 말고, 먼저 그 이야기를 따뜻하게 받아주고 더 깊이 들어가는 후속 질문을 던지세요. 구체적인 장면·감각·감정·사람·관계가 드러나도록, 자서전에 한 문단으로 옮길 수 있을 만큼 생생하게 끌어내는 것이 목표입니다.",
    "위 [이 주제에서 함께 더듬어 갈 결]은 방향을 잡기 위한 참고일 뿐, 빠짐없이 채워야 할 체크리스트가 아닙니다. 사용자가 들려주는 흐름을 우선하세요.",
    "",
    "[이야기 저장 — save_story]",
    "사용자가 의미 있는 이야기를 들려줄 때마다 save_story를 호출해, '지금까지의 전체 이야기'를 평문 한국어로 자연스럽게 정리한 요약을 통째로 저장하세요(매번 전체본을 다시 써서 덮어씁니다). 사용자가 실제로 말한 내용만 담고, 없는 사실은 만들지 마세요. 이 저장본이 다음 단계에서 글의 재료가 됩니다.",
    "",
    "[마무리 — mark_complete]",
    "주제에 대한 이야기가 한 편의 짧은 글로 옮기기에 충분히 모였다고 느껴지면(보통 대여섯 번 이상 의미 있게 주고받은 뒤), 그 턴에서 (a) 마지막 save_story로 전체 이야기를 한 번 더 정리해 저장하고, (b) 짧고 따뜻한 마무리 인사 2~3문장을 건넨 뒤, (c) 같은 턴에서 곧바로 mark_complete를 호출하세요. mark_complete를 호출하면 사용자 화면에 '이야기 만들기'로 넘어가는 버튼이 나타납니다. 자동으로 넘어가지 않으니, 마무리 인사에서 '준비되면 이야기 만들기로 넘어가요' 정도로 자연스럽게 안내해 주세요. 사용자가 '이제 그만', '글로 옮기고 싶어'처럼 마치고 싶어 하면 더 캐묻지 말고 바로 마무리하세요.",
    "",
    "[필수 규칙]",
    "1. 한 답변에는 새 질문을 하나만 담으세요(직전 답변에 대한 자연스러운 후속 질문은 괜찮습니다).",
    "2. 질문은 매번 사용자의 어휘·분위기·호흡에 맞춰 새로 빚어내세요. 격식 있게 답하면 격식 있게, 단답이면 부드럽게 풀어서, 감정을 깊이 꺼내면 한 톤 낮춰서.",
    '3. 사용자가 "모르겠다 / 기억 안 난다"고 하면 한 번 더 부드럽게 단서를 끌어내 보고, 그래도 어려워하면 다른 결로 자연스럽게 옮겨가세요.',
    "4. 친근하고 담백한 한국어로, 한 답변은 4문장을 넘지 마세요.",
    "5. 마크다운 강조 표기를 절대 쓰지 마세요. **굵게**, *기울임*, __강조__ 같은 기호로 단어를 감싸지 말고, 모든 답변은 평문 한국어로만 작성합니다. 별표(*, **)는 출력하지 마세요.",
    "6. 답변은 반드시 한국어로만 합니다. 영어 단어·문장·번역어 표기를 섞지 마세요. 외래어가 꼭 필요하면 한글로 음차해서 적습니다(예: 'agent' → '에이전트').",
  ].join("\n");
}

export async function persistStory(
  folderId: string,
  summary: string,
): Promise<string> {
  const next = summary.trim();
  if (next.length === 0) return "";
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

export async function loadFolderState(folderId: string): Promise<{
  name: string;
  category: CategoryConfig;
  story: string;
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
  const story = getStory(data.memory_inputs);
  return { name: data.name, category, story };
}
