"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  formatAnswersForPrompt,
  getCategoryByName,
  normalizeAnswers,
} from "../categories";

const BUCKET = "illustrations";
const MIN_SCENES = 1;
const MAX_SCENES = 5;

export type Scene = { caption: string; prompt: string };

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function objectPath(userId: string, folderId: string, sceneIndex: number) {
  return `${userId}/${folderId}-${sceneIndex}.png`;
}

function buildImagePrompt(scene: Scene, draftExcerpt: string): string {
  return [
    "A single hand-drawn illustration in a delicate pen-and-ink style with visible pressure variation in the line work, like a fine writer's notebook sketch.",
    "Monochrome ink (warm dark brown ink on warm off-white paper). No text, no captions, no signatures.",
    "Composition: minimalist, intimate, slightly cinematic, with breathing white space and soft cross-hatching for tone. Square 1:1.",
    "",
    "Scene:",
    scene.prompt,
    "",
    "Source memory excerpt (tone reference only — depict the scene above, do not invent details beyond it):",
    draftExcerpt.slice(0, 500),
  ].join("\n");
}

const SCENE_PLAN_SYSTEM_PROMPT = [
  "당신은 사용자의 짧은 회고문을 읽고 그 글의 핵심 장면을 1~5개로 추려내는 일러스트 디렉터입니다.",
  "",
  "[규칙]",
  "- 글의 길이와 장면 전환 수를 보고 자연스럽게 몇 개가 필요한지 정하세요. 짧고 한 장면이면 1~2개, 시간/공간/감정 전환이 뚜렷하면 3~5개까지.",
  "- 같은 장면을 약간 다른 각도로 두 번 그리지 마세요. 매번 다른 순간이어야 합니다.",
  "- 각 장면은 글의 흐름 순서대로 배열하세요.",
  "- 각 장면에 두 가지 필드:",
  "  - caption: 한국어, 6~16자. 그 장면을 가리키는 짧은 라벨.",
  "  - prompt: 영어, 40~80 단어. 그 장면을 hand-drawn pen-and-ink illustration으로 그리기 위한 시각적 묘사. 인물의 표정/자세, 장소, 시간대, 빛, 공기감을 구체적으로. 큰따옴표나 별표 사용 금지.",
  "- 글에 명시되지 않은 사실은 만들지 않습니다.",
  '- 결과는 JSON으로만: {"scenes":[{"caption":"...","prompt":"..."},...]}',
  "- 코드 블록, 추가 설명, 머리말 금지.",
].join("\n");

async function planScenesWithLLM(args: {
  categoryName: string;
  folderName: string;
  answersBlock: string;
  draft: string;
}): Promise<Scene[]> {
  const openai = getOpenAI();
  if (!openai) throw new Error("OPENAI_API_KEY가 설정되지 않았어요.");

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SCENE_PLAN_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `카테고리: ${args.categoryName}`,
          `폴더 이름: ${args.folderName}`,
          "",
          "사용자의 답변:",
          args.answersBlock,
          "",
          "사용자의 글:",
          args.draft,
        ].join("\n"),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { scenes?: Array<{ caption?: unknown; prompt?: unknown }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("장면 분석 결과를 해석하지 못했어요.");
  }

  const cleaned: Scene[] = (parsed.scenes ?? [])
    .map((s) => ({
      caption: typeof s.caption === "string" ? s.caption.trim() : "",
      prompt: typeof s.prompt === "string" ? s.prompt.trim() : "",
    }))
    .filter((s) => s.caption.length > 0 && s.prompt.length > 0)
    .slice(0, MAX_SCENES);

  if (cleaned.length < MIN_SCENES) {
    throw new Error("장면 분석 결과가 비어 있어요.");
  }
  return cleaned;
}

async function removeFolderObjects(
  supabase: SupabaseClient,
  userId: string,
  folderId: string,
): Promise<void> {
  const { data } = await supabase.storage.from(BUCKET).list(userId, {
    limit: 100,
  });
  const toRemove = (data ?? [])
    .filter((o) => o.name.startsWith(`${folderId}-`))
    .map((o) => `${userId}/${o.name}`);
  if (toRemove.length) {
    await supabase.storage.from(BUCKET).remove(toRemove);
  }
}

export type PlanResult = {
  scenes: Scene[];
  reused: boolean;
  error: string | null;
};

export async function planFinalize(folderId: string): Promise<PlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: folder } = await supabase
    .from("folders")
    .select(
      "id, name, memory_inputs, memory_generated, image_draft, image_scenes, image_target_count",
    )
    .eq("id", folderId)
    .maybeSingle();
  if (!folder) {
    return { scenes: [], reused: false, error: "폴더를 찾지 못했어요." };
  }

  const category = getCategoryByName(folder.name);
  if (!category) {
    return {
      scenes: [],
      reused: false,
      error: "이 폴더는 일러스트 생성이 지원되지 않아요.",
    };
  }

  const draft = ((folder.memory_generated as string | null) ?? "").trim();
  if (!draft) {
    return {
      scenes: [],
      reused: false,
      error: "글이 비어 있어요. 한 줄이라도 적어 주세요.",
    };
  }

  const existingDraft = ((folder.image_draft as string | null) ?? "").trim();
  const existingScenes = (folder.image_scenes as Scene[] | null) ?? [];
  if (
    existingDraft.length > 0 &&
    existingDraft === draft &&
    existingScenes.length > 0
  ) {
    return { scenes: existingScenes, reused: true, error: null };
  }

  const answers = normalizeAnswers(
    category,
    (folder.memory_inputs ?? {}) as Record<string, unknown>,
  );

  let scenes: Scene[];
  try {
    scenes = await planScenesWithLLM({
      categoryName: category.name,
      folderName: folder.name,
      answersBlock: formatAnswersForPrompt(category, answers),
      draft,
    });
  } catch (e) {
    return {
      scenes: [],
      reused: false,
      error: e instanceof Error ? e.message : "장면 분석에 실패했어요.",
    };
  }

  await removeFolderObjects(supabase, user.id, folder.id);

  const { error: updErr } = await supabase
    .from("folders")
    .update({
      image_draft: draft,
      image_target_count: scenes.length,
      image_scenes: scenes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folder.id);
  if (updErr) {
    return { scenes: [], reused: false, error: updErr.message };
  }

  revalidatePath(`/folders/${folder.id}/post`);
  return { scenes, reused: false, error: null };
}

export type GenerateSceneResult = {
  url: string | null;
  error: string | null;
};

export async function generateSceneImage(
  folderId: string,
  sceneIndex: number,
): Promise<GenerateSceneResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const openai = getOpenAI();
  if (!openai) {
    return { url: null, error: "OPENAI_API_KEY가 설정되지 않았어요." };
  }

  const { data: folder } = await supabase
    .from("folders")
    .select("id, name, memory_generated, image_scenes")
    .eq("id", folderId)
    .maybeSingle();
  if (!folder) return { url: null, error: "폴더를 찾지 못했어요." };

  const scenes = (folder.image_scenes as Scene[] | null) ?? [];
  if (sceneIndex < 0 || sceneIndex >= scenes.length) {
    return { url: null, error: "잘못된 장면 인덱스예요." };
  }
  const scene = scenes[sceneIndex];
  const draft = ((folder.memory_generated as string | null) ?? "").trim();

  let b64: string | undefined;
  try {
    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt: buildImagePrompt(scene, draft),
      size: "1024x1024",
      n: 1,
    });
    b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      const url = result.data?.[0]?.url;
      if (url) {
        const fetched = await fetch(url);
        b64 = Buffer.from(await fetched.arrayBuffer()).toString("base64");
      }
    }
  } catch (e) {
    return {
      url: null,
      error:
        e instanceof Error
          ? `이미지 생성 실패: ${e.message}`
          : "이미지 생성에 실패했어요.",
    };
  }
  if (!b64) {
    return { url: null, error: "이미지 데이터를 받지 못했어요." };
  }

  const buffer = Buffer.from(b64, "base64");
  const path = objectPath(user.id, folder.id, sceneIndex);
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (upload.error) {
    const msg = upload.error.message;
    if (msg.toLowerCase().includes("bucket not found")) {
      return {
        url: null,
        error:
          "Supabase Storage에 'illustrations' 버킷이 없어요. supabase-setup.sql 을 실행해 주세요.",
      };
    }
    return { url: null, error: `이미지 업로드 실패: ${msg}` };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  revalidatePath(`/folders/${folder.id}/post`);
  return { url: pub?.publicUrl ?? null, error: null };
}

export type PostState = {
  scenes: Scene[];
  urls: (string | null)[];
  draft: string;
  folderName: string;
  hasPlan: boolean;
  error: string | null;
};

export async function loadPostState(folderId: string): Promise<PostState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      scenes: [],
      urls: [],
      draft: "",
      folderName: "",
      hasPlan: false,
      error: "로그인이 필요해요.",
    };
  }

  const { data: folder } = await supabase
    .from("folders")
    .select(
      "id, name, memory_generated, image_scenes, image_target_count",
    )
    .eq("id", folderId)
    .maybeSingle();
  if (!folder) {
    return {
      scenes: [],
      urls: [],
      draft: "",
      folderName: "",
      hasPlan: false,
      error: "폴더를 찾지 못했어요.",
    };
  }

  const scenes = (folder.image_scenes as Scene[] | null) ?? [];
  const N = Math.max(
    (folder.image_target_count as number | null) ?? 0,
    scenes.length,
  );
  const urls: (string | null)[] = new Array(N).fill(null);

  if (N > 0) {
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(user.id, { limit: 100 });
    const folderPrefix = `${folder.id}-`;
    const re = new RegExp(`^${folder.id}-(\\d+)\\.png$`);
    for (const f of files ?? []) {
      if (!f.name.startsWith(folderPrefix)) continue;
      const m = f.name.match(re);
      if (!m) continue;
      const idx = parseInt(m[1], 10);
      if (idx >= 0 && idx < N) {
        const { data: pub } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${user.id}/${f.name}`);
        urls[idx] = pub?.publicUrl ?? null;
      }
    }
  }

  return {
    scenes,
    urls,
    draft: ((folder.memory_generated as string | null) ?? "").trim(),
    folderName: folder.name as string,
    hasPlan: scenes.length > 0,
    error: null,
  };
}
