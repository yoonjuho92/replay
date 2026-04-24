"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

export type MemoryInput = {
  regret: string;
  people: string;
  place: string;
  outcome: string;
};

export type MemorySave = MemoryInput & { generated: string };

export type MemoryChoices = {
  items: { text: string; narrative: string }[];
  selected: number | null;
};

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function saveMemory(
  folderId: string,
  input: MemorySave,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("folders")
    .update({
      memory_text: input.regret,
      memory_people: input.people,
      memory_place: input.place,
      memory_outcome: input.outcome,
      memory_generated: input.generated,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId);

  if (error) return { error: error.message };

  revalidatePath(`/folders/${folderId}`);
  revalidatePath("/folders");
  return { error: null };
}

export async function saveMemoryChoices(
  folderId: string,
  memoryChoices: MemoryChoices,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("folders")
    .update({
      memory_choices: memoryChoices,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId);

  if (error) return { error: error.message };

  revalidatePath(`/folders/${folderId}`);
  return { error: null };
}

export async function generateNarrative(
  input: MemoryInput,
): Promise<{ text: string; error: string | null }> {
  const openai = getOpenAI();
  if (!openai) {
    return { text: "", error: "OPENAI_API_KEY가 설정되지 않았어요." };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [
        {
          role: "system",
          content:
            "사용자가 후회하는 과거의 선택에 대한 4가지 답변(후회하는 선택, 함께한 사람, 장소, 결과)을 바탕으로, 사용자가 실제로 겪은 그 일을 한 편의 짧은 회고문으로 정리해 주세요. 1인칭 과거형(나는 ~했다 형태)으로, 담백하고 진솔한 어조로 3~5문장 분량. 새로운 사실을 만들어내지 말고 주어진 답변에서 드러난 내용을 자연스러운 문장으로 풀어내세요. 따옴표나 불필요한 수식 없이 본문만 작성합니다.",
        },
        {
          role: "user",
          content: [
            `후회하는 선택: ${input.regret}`,
            `함께한 사람: ${input.people}`,
            `장소: ${input.place}`,
            `결과: ${input.outcome}`,
          ].join("\n"),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return { text, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "글 생성에 실패했어요.";
    return { text: "", error: message };
  }
}

export async function generateAndSaveChoices(
  folderId: string,
  input: MemorySave,
): Promise<{ choices: MemoryChoices | null; error: string | null }> {
  const openai = getOpenAI();
  if (!openai) {
    return { choices: null, error: "OPENAI_API_KEY가 설정되지 않았어요." };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [
        {
          role: "system",
          content:
            "사용자가 후회하는 과거 기억을 보고, 그 순간에 할 수 있었던 다른 선택지 3가지를 한 줄씩 제안해 주세요. 각 선택지는 서로 다른 방향성을 가져야 하며, 평이한 한국어로 한 문장씩 작성합니다. 그 선택을 했다고 가정하고, 시간이 지난 뒤에 그때를 돌아보며(새로고침한 기억을 돌아보며) 적는다고 생각하고 글을 적어주세요. 나는 (새로운 선택을) 했다. (가정이지만 글에서는 가정이 아니라 진짜 그 선택을 했다는 것처럼 — ~했다면이 아니라 ~했다.) 그래서 (어떤 삶을) 살았다. 결과는 줄바꿈으로 구분된 정확히 3줄로만 출력하세요. 번호, 따옴표, 머리글 없이 본문만.",
        },
        {
          role: "user",
          content: [
            `후회하는 선택: ${input.regret}`,
            `함께한 사람: ${input.people}`,
            `장소: ${input.place}`,
            `결과: ${input.outcome}`,
            "",
            `새로고침된 기억(회고문):`,
            input.generated,
          ].join("\n"),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const lines = raw
      .split("\n")
      .map((line) => line.replace(/^[\s\-•·–—\d\.)·]+/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 3);

    if (lines.length < 3) {
      return { choices: null, error: "선택지 3개를 만들지 못했어요." };
    }

    const memoryChoices: MemoryChoices = {
      items: lines.map((text) => ({ text, narrative: "" })),
      selected: null,
    };

    const saveRes = await saveMemoryChoices(folderId, memoryChoices);
    if (saveRes.error) return { choices: null, error: saveRes.error };

    return { choices: memoryChoices, error: null };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "선택지 생성에 실패했어요.";
    return { choices: null, error: message };
  }
}

export async function generateAndSaveStory(
  folderId: string,
  input: {
    generated: string;
    choices: MemoryChoices;
    selectedIndex: number;
  },
): Promise<{ choices: MemoryChoices | null; error: string | null }> {
  const openai = getOpenAI();
  if (!openai) {
    return { choices: null, error: "OPENAI_API_KEY가 설정되지 않았어요." };
  }

  const item = input.choices.items[input.selectedIndex];
  if (!item) {
    return { choices: null, error: "선택한 항목을 찾지 못했어요." };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [
        {
          role: "system",
          content:
            "사용자가 후회하는 과거 기억과 그 순간에 할 수 있었던 다른 선택지가 주어집니다. 그 선택을 진짜로 했다고 가정하고, 시간이 지난 뒤에 그때를 돌아보며(새로고침한 기억을 돌아보며) 적는다고 생각하고 글을 적어주세요. 가정이지만 글에서는 가정이 아니라 실제로 그 선택을 한 것처럼 — ~했다면이 아니라 ~했다 형태로 — 3~5문장의 짧은 이야기로 한국어로 써 주세요. 담백하고 진솔한 어조. 따옴표나 불필요한 수식 없이 본문만 작성합니다.",
        },
        {
          role: "user",
          content: `사용자가 후회하는 과거 기억:\n${input.generated}\n\n새로고침할 선택:\n${item.text}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return { choices: null, error: "이야기를 만들지 못했어요." };
    }

    const nextItems = input.choices.items.map((existing, i) =>
      i === input.selectedIndex ? { ...existing, narrative: text } : existing,
    );
    const next: MemoryChoices = {
      items: nextItems,
      selected: input.selectedIndex,
    };

    const saveRes = await saveMemoryChoices(folderId, next);
    if (saveRes.error) return { choices: null, error: saveRes.error };

    return { choices: next, error: null };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "이야기 생성에 실패했어요.";
    return { choices: null, error: message };
  }
}

export async function selectChoice(
  folderId: string,
  choices: MemoryChoices,
  selectedIndex: number,
): Promise<{ choices: MemoryChoices | null; error: string | null }> {
  const next: MemoryChoices = { ...choices, selected: selectedIndex };
  const saveRes = await saveMemoryChoices(folderId, next);
  if (saveRes.error) return { choices: null, error: saveRes.error };
  return { choices: next, error: null };
}
