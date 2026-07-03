"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  TOPIC_PICK_COUNT,
  getCategoryBySlug,
  isCategorySlug,
} from "../categories";
import { createFoldersForSlugs } from "../seed";

export type SelectTopicsState = { error: string | null };

export async function selectTopicsAction(
  _prev: SelectTopicsState,
  formData: FormData,
): Promise<SelectTopicsState> {
  // 폼에서 고른 주제 slug들(중복 제거)
  const slugs = [
    ...new Set(formData.getAll("slug").map((v) => String(v))),
  ].filter(isCategorySlug);

  if (slugs.length !== TOPIC_PICK_COUNT) {
    return { error: `주제를 ${TOPIC_PICK_COUNT}개 골라 주세요.` };
  }
  if (!slugs.every((s) => getCategoryBySlug(s)?.available)) {
    return { error: "고를 수 없는 주제가 있어요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await createFoldersForSlugs(supabase, user.id, slugs);
  redirect("/folders");
}
