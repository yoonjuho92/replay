"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

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
