"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { NewFolderInput } from "@/app/_components/NewFolderModal";

const MAX_FOLDERS = 5;

type ActionResult = { error: string | null };

export async function createFolder(
  input: NewFolderInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = input.name.trim();
  if (!name) return { error: "폴더 이름을 입력해 주세요." };

  const { count, error: countError } = await supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return { error: countError.message };
  if ((count ?? 0) >= MAX_FOLDERS) {
    return { error: "폴더는 최대 5개까지 만들 수 있어요." };
  }

  const memoryDate = input.date
    ? `${input.date.year}-${String(input.date.month).padStart(2, "0")}-${String(input.date.day).padStart(2, "0")}`
    : null;

  const { error } = await supabase.from("folders").insert({
    user_id: user.id,
    name,
    memory_date: memoryDate,
  });
  if (error) return { error: error.message };

  revalidatePath("/folders");
  return { error: null };
}
