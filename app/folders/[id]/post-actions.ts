"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import OpenAI, { toFile } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_BUCKET, findProfilePhoto } from "@/lib/profile-photo";
import {
  type ImageStyle,
  formatStoryForPrompt,
  getCategoryByName,
  getImageStyle,
  getStory,
} from "../categories";
import { AGENT_MODEL, IMAGE_MODEL } from "../prompts/models";
import {
  type Scene,
  SCENE_PLAN_SYSTEM_PROMPT,
  buildImagePrompt,
  buildScenePlanUserPrompt,
} from "../prompts/image";

export type { Scene };

const BUCKET = "illustrations";
// 그림은 주제마다 반드시 3장씩 만든다.
const SCENE_COUNT = 3;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function objectPath(userId: string, folderId: string, sceneIndex: number) {
  return `${userId}/${folderId}-${sceneIndex}.png`;
}

async function planScenesWithLLM(args: {
  categoryName: string;
  folderName: string;
  answersBlock: string;
  draft: string;
}): Promise<Scene[]> {
  const openai = getOpenAI();
  if (!openai) throw new Error("OPENAI_API_KEY가 설정되지 않았어요.");

  const completion = await openai.chat.completions.create({
    model: AGENT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SCENE_PLAN_SYSTEM_PROMPT },
      { role: "user", content: buildScenePlanUserPrompt(args) },
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
    .slice(0, SCENE_COUNT);

  if (cleaned.length < SCENE_COUNT) {
    throw new Error("장면 3개를 만들지 못했어요. 글을 조금 더 적고 다시 시도해 주세요.");
  }
  return cleaned;
}

async function loadProfileReference(
  supabase: SupabaseClient,
  userId: string,
) {
  const existing = await findProfilePhoto(supabase, userId);
  if (!existing) return null;
  const { data, error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .download(existing.path);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  const mime = data.type || "image/png";
  const ext = existing.path.split(".").pop() ?? "png";
  return toFile(buffer, `profile.${ext}`, { type: mime });
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

export async function planFinalize(
  folderId: string,
  style: ImageStyle,
): Promise<PlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: folder } = await supabase
    .from("folders")
    .select(
      "id, name, memory_inputs, memory_generated, image_draft, image_scenes, image_target_count, image_style",
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
  const existingStyle = getImageStyle(folder.image_style);
  const styleChanged = existingStyle !== style;
  const canReuseScenes =
    existingDraft.length > 0 &&
    existingDraft === draft &&
    existingScenes.length > 0;

  // 글이 그대로이고 스타일도 그대로라면 다시 분석할 필요가 없다.
  if (canReuseScenes && !styleChanged) {
    return { scenes: existingScenes, reused: true, error: null };
  }

  let scenes: Scene[];
  if (canReuseScenes) {
    // 글은 그대로지만 스타일만 바뀐 경우 — 장면은 재사용하고 그림만 다시 그린다.
    scenes = existingScenes;
  } else {
    const story = getStory(folder.memory_inputs);
    try {
      scenes = await planScenesWithLLM({
        categoryName: category.name,
        folderName: folder.name,
        answersBlock: formatStoryForPrompt(story),
        draft,
      });
    } catch (e) {
      return {
        scenes: [],
        reused: false,
        error: e instanceof Error ? e.message : "장면 분석에 실패했어요.",
      };
    }
  }

  // 새 장면이거나 스타일이 바뀌었으면 이전 그림을 지워 다시 그리게 한다.
  await removeFolderObjects(supabase, user.id, folder.id);

  const { error: updErr } = await supabase
    .from("folders")
    .update({
      image_draft: draft,
      image_target_count: scenes.length,
      image_scenes: scenes,
      image_style: style,
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
    .select("id, name, memory_generated, image_scenes, image_style")
    .eq("id", folderId)
    .maybeSingle();
  if (!folder) return { url: null, error: "폴더를 찾지 못했어요." };

  const scenes = (folder.image_scenes as Scene[] | null) ?? [];
  if (sceneIndex < 0 || sceneIndex >= scenes.length) {
    return { url: null, error: "잘못된 장면 인덱스예요." };
  }
  const scene = scenes[sceneIndex];
  const draft = ((folder.memory_generated as string | null) ?? "").trim();
  const style = getImageStyle(folder.image_style);

  const reference = await loadProfileReference(supabase, user.id);
  const prompt = buildImagePrompt(scene, draft, reference !== null, style);

  let b64: string | undefined;
  try {
    if (reference) {
      const result = await openai.images.edit({
        model: IMAGE_MODEL,
        image: reference,
        prompt,
        quality: "low",
        size: "1024x1024",
      });
      b64 = result.data?.[0]?.b64_json;
    } else {
      const result = await openai.images.generate({
        model: IMAGE_MODEL,
        prompt,
        quality: "low",
        size: "1024x1024",
        moderation: "low",
      });
      b64 = result.data?.[0]?.b64_json;
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
  const upload = await supabase.storage.from(BUCKET).upload(path, buffer, {
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
  const publicUrl = pub?.publicUrl
    ? `${pub.publicUrl}?v=${Date.now()}`
    : null;
  return { url: publicUrl, error: null };
}

export type PostState = {
  scenes: Scene[];
  urls: (string | null)[];
  draft: string;
  folderName: string;
  style: ImageStyle;
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
      style: getImageStyle(null),
      hasPlan: false,
      error: "로그인이 필요해요.",
    };
  }

  const { data: folder } = await supabase
    .from("folders")
    .select(
      "id, name, memory_generated, image_scenes, image_target_count, image_style",
    )
    .eq("id", folderId)
    .maybeSingle();
  if (!folder) {
    return {
      scenes: [],
      urls: [],
      draft: "",
      folderName: "",
      style: getImageStyle(null),
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
        if (pub?.publicUrl) {
          const updatedAt = f.updated_at ?? f.created_at ?? "";
          const v = updatedAt
            ? new Date(updatedAt).getTime() || Date.now()
            : Date.now();
          urls[idx] = `${pub.publicUrl}?v=${v}`;
        }
      }
    }
  }

  return {
    scenes,
    urls,
    draft: ((folder.memory_generated as string | null) ?? "").trim(),
    folderName: folder.name as string,
    style: getImageStyle(folder.image_style),
    hasPlan: scenes.length > 0,
    error: null,
  };
}
