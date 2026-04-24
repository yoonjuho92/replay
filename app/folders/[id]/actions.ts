"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  INPUT_FIELDS,
  formatInputForPrompt,
  type MemoryChoices,
  type MemoryInput,
  type MemorySave,
} from "./inputs";

type ActionResult = { error: string | null };

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function getFolderContext(
  folderId: string,
): Promise<{ name: string; memoryDate: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("name, memory_date")
    .eq("id", folderId)
    .maybeSingle();
  if (!data) return null;
  return { name: data.name, memoryDate: data.memory_date };
}

function formatFolderContext(ctx: {
  name: string;
  memoryDate: string | null;
}): string {
  return [
    `폴더 이름(사건의 주제): ${ctx.name}`,
    `사건이 일어난 날짜: ${ctx.memoryDate ?? "기록되지 않음"}`,
  ].join("\n");
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

  const inputs: MemoryInput = INPUT_FIELDS.reduce(
    (acc, key) => ({ ...acc, [key]: input[key] ?? "" }),
    {} as MemoryInput,
  );

  const { error } = await supabase
    .from("folders")
    .update({
      memory_inputs: inputs,
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
  folderId: string,
  input: MemoryInput,
): Promise<{ text: string; error: string | null }> {
  const openai = getOpenAI();
  if (!openai) {
    return { text: "", error: "OPENAI_API_KEY가 설정되지 않았어요." };
  }

  const ctx = await getFolderContext(folderId);
  if (!ctx) {
    return { text: "", error: "폴더 정보를 찾지 못했어요." };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content:
            "사용자가 후회하는 과거 기억에 관한 12가지 답변과 그 사건의 주제(폴더 이름), 일어난 날짜를 바탕으로, 사용자가 실제로 겪은 그 일을 A4 한 페이지 분량(약 800~1000자, 4~6문단)의 1인칭 에세이로 풀어내 주세요. 1인칭 과거형(나는 ~했다 형태)으로, 그 순간의 장면(장소, 함께 있던 사람, 행동, 날씨, 소리, 옷차림, 마음속 경고음, 함께 있던 사람의 반응, 미처 하지 못한 말 등)과 사건의 주제·시점이 충분히 묘사되도록 풍부하게 적되 주어진 정보 안에서만 상상하고 새로운 사실은 만들어내지 마세요. 감정과 후회의 결을 자연스럽게 녹여내고, 따옴표나 머리글, 제목 없이 본문만.",
        },
        {
          role: "user",
          content: [
            formatFolderContext(ctx),
            "",
            formatInputForPrompt(input),
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

  const ctx = await getFolderContext(folderId);
  if (!ctx) {
    return { choices: null, error: "폴더 정보를 찾지 못했어요." };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content:
            "사용자가 후회하는 과거 기억을 보고, 그 순간에 할 수 있었던 다른 선택지 3가지를 한 줄씩 제안해 주세요. 각 선택지는 서로 다른 방향성을 가져야 하며, 평이한 한국어로 한 문장씩 작성합니다. 그 선택을 했다고 가정하고, 시간이 지난 뒤에 그때를 돌아보며(새로고침한 기억을 돌아보며) 적는다고 생각하고 글을 적어주세요. 나는 (새로운 선택을) 했다. (가정이지만 글에서는 가정이 아니라 진짜 그 선택을 했다는 것처럼 — ~했다면이 아니라 ~했다.) 그래서 (어떤 삶을) 살았다. 결과는 줄바꿈으로 구분된 정확히 3줄로만 출력하세요. 번호, 따옴표, 머리글 없이 본문만.",
        },
        {
          role: "user",
          content: [
            formatFolderContext(ctx),
            "",
            "사용자의 답변:",
            formatInputForPrompt(input),
            "",
            "정리된 회고문:",
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

  const ctx = await getFolderContext(folderId);
  if (!ctx) {
    return { choices: null, error: "폴더 정보를 찾지 못했어요." };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content:
            "사용자가 후회하는 과거 기억(주제, 일어난 날짜 포함)과 그 순간에 할 수 있었던 다른 선택지가 주어집니다. 그 선택을 진짜로 했다고 가정하고, 시간이 지난 뒤에 그때를 돌아보며(새로고침한 기억을 돌아보며) 적는다고 생각하고 한국어로 적어주세요. 가정이지만 글에서는 가정이 아니라 실제로 그 선택을 한 것처럼 — ~했다면이 아니라 ~했다 형태로 — A4 한 페이지 분량(약 800~1000자, 4~6문단)의 1인칭 에세이로 풀어내 주세요. 그 선택 이후의 장면, 감정, 함께 있던 사람과의 흐름, 시간이 흐른 뒤의 깨달음을 담백하고 진솔한 어조로 자연스럽게 풀어냅니다. 따옴표나 머리글, 제목 없이 본문만 작성합니다.",
        },
        {
          role: "user",
          content: [
            formatFolderContext(ctx),
            "",
            "사용자가 후회하는 과거 기억:",
            input.generated,
            "",
            "새로고침할 선택:",
            item.text,
          ].join("\n"),
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
