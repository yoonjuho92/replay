import type { SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_FOLDER_NAMES } from "./categories";

export async function ensureSystemFolders(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("folders")
    .select("name")
    .eq("user_id", userId);

  const haveNames = new Set((existing ?? []).map((row) => row.name as string));
  const missing = SYSTEM_FOLDER_NAMES.filter((n) => !haveNames.has(n));
  if (missing.length === 0) return;

  await supabase.from("folders").insert(
    missing.map((name) => ({
      user_id: userId,
      name,
    })),
  );
}
