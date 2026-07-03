"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategoryByName } from "../categories";

type ActionResult = { error: string | null };

/** 삽화가 저장되는 스토리지 버킷 (post-actions.ts와 동일) */
const ILLUSTRATION_BUCKET = "illustrations";

/**
 * 폴더의 주제(카테고리)를 다른 주제로 바꾼다.
 * 주제가 바뀌면 이전 주제에 속한 이야기·글·삽화는 모두 이 주제의 것이 아니게 되므로 함께 지운다.
 * (되돌릴 수 없는 동작이라 UI에서 반드시 경고·확인을 받은 뒤 호출한다.)
 */
export async function changeTopic(
  folderId: string,
  newName: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const target = getCategoryByName(newName);
  if (!target || !target.available) {
    return { error: "바꿀 수 있는 주제가 아니에요." };
  }

  // 이 폴더가 내 것이고 아는 주제인지 확인한다.
  const { data: folder } = await supabase
    .from("folders")
    .select("id, name")
    .eq("id", folderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!folder) return { error: "폴더를 찾지 못했어요." };
  if (folder.name === newName) return { error: null };

  // 같은 주제의 폴더가 이미 있으면 주제가 겹치므로 막는다.
  const { data: dup } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", newName)
    .maybeSingle();
  if (dup) return { error: "이미 그 주제의 폴더가 있어요." };

  // 이전 주제로 만든 삽화를 스토리지에서 지운다.
  const { data: files } = await supabase.storage
    .from(ILLUSTRATION_BUCKET)
    .list(user.id, { limit: 100 });
  const toRemove = (files ?? [])
    .filter((o) => o.name.startsWith(`${folderId}-`))
    .map((o) => `${user.id}/${o.name}`);
  if (toRemove.length) {
    await supabase.storage.from(ILLUSTRATION_BUCKET).remove(toRemove);
  }

  // 주제를 바꾸고, 이전 주제에 속한 내용은 모두 비운다.
  const { error } = await supabase
    .from("folders")
    .update({
      // 이야기·글은 NOT NULL 컬럼이라 빈 문자열로 비운다.
      name: newName,
      memory_inputs: "",
      memory_generated: "",
      // 삽화 관련 컬럼은 nullable이라 null로 비운다.
      image_draft: null,
      image_scenes: null,
      image_target_count: null,
      image_style: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/folders");
  revalidatePath(`/folders/${folderId}`);
  revalidatePath(`/folders/${folderId}/write`);
  revalidatePath(`/folders/${folderId}/post`);
  return { error: null };
}

export async function saveDraft(
  folderId: string,
  draft: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("folders")
    .update({
      memory_generated: draft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId);

  if (error) return { error: error.message };

  revalidatePath(`/folders/${folderId}`);
  revalidatePath(`/folders/${folderId}/write`);
  return { error: null };
}
