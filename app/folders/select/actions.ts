"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPairById } from "../categories";
import { createPairFolders } from "../seed";

export type SelectPairState = { error: string | null };

export async function selectPairAction(
  _prev: SelectPairState,
  formData: FormData,
): Promise<SelectPairState> {
  const pairId = String(formData.get("pairId") ?? "");
  const pair = getPairById(pairId);
  if (!pair) return { error: "주제를 다시 골라 주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await createPairFolders(supabase, user.id, pair);
  redirect("/folders");
}
