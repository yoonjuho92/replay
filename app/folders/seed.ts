import type { SupabaseClient } from "@supabase/supabase-js";
import { type TopicPair, getCategoryBySlug } from "./categories";

/**
 * 사용자가 고른 주제 쌍의 두 주제를 폴더로 만든다(이미 있으면 건너뜀).
 */
export async function createPairFolders(
  supabase: SupabaseClient,
  userId: string,
  pair: TopicPair,
): Promise<void> {
  const names = pair.slugs
    .map((slug) => getCategoryBySlug(slug)?.name)
    .filter((n): n is string => Boolean(n));

  const { data: existing } = await supabase
    .from("folders")
    .select("name")
    .eq("user_id", userId);

  const haveNames = new Set((existing ?? []).map((row) => row.name as string));
  const missing = names.filter((n) => !haveNames.has(n));
  if (missing.length === 0) return;

  await supabase.from("folders").insert(
    missing.map((name) => ({
      user_id: userId,
      name,
    })),
  );
}
