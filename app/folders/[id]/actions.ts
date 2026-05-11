"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type CategoryConfig,
  getCategoryByName,
  normalizeAnswers,
} from "../categories";

type ActionResult = { error: string | null };

async function loadFolder(
  folderId: string,
): Promise<{ name: string; category: CategoryConfig } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("name")
    .eq("id", folderId)
    .maybeSingle();
  if (!data) return null;
  const category = getCategoryByName(data.name);
  if (!category) return null;
  return { name: data.name, category };
}

export async function saveAnswers(
  folderId: string,
  answers: Record<string, string>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const folder = await loadFolder(folderId);
  if (!folder) return { error: "폴더를 찾지 못했어요." };

  const normalized = normalizeAnswers(folder.category, answers);

  const { error } = await supabase
    .from("folders")
    .update({
      memory_inputs: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId);

  if (error) return { error: error.message };

  revalidatePath(`/folders/${folderId}`);
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
