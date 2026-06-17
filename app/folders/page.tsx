import { redirect } from "next/navigation";
import { BrowserWindow } from "../_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIES,
  SYSTEM_FOLDER_NAMES,
  getCategoryByName,
} from "./categories";
import { FoldersGrid, type FolderRow } from "./_components/FoldersGrid";
import { ensureSystemFolders } from "./seed";

export default async function FoldersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await ensureSystemFolders(supabase, user.id);

  const { data } = await supabase
    .from("folders")
    .select("id,name,memory_generated")
    .in("name", SYSTEM_FOLDER_NAMES)
    .eq("user_id", user.id);

  // Optional columns added by supabase-setup.sql. If the SQL has not been
  // run yet, this select errors and we treat every folder as not-finalized.
  const extrasById = new Map<
    string,
    { imageDraft: string; sceneCount: number }
  >();
  const folderIds = (data ?? []).map((r) => r.id as string);
  if (folderIds.length > 0) {
    const { data: extras } = await supabase
      .from("folders")
      .select("id, image_draft, image_scenes")
      .in("id", folderIds);
    for (const row of extras ?? []) {
      const sceneCount = Array.isArray(row.image_scenes)
        ? (row.image_scenes as unknown[]).length
        : 0;
      extrasById.set(row.id as string, {
        imageDraft: ((row.image_draft as string | null) ?? "").trim(),
        sceneCount,
      });
    }
  }

  const byName = new Map<string, FolderRow>();
  for (const row of data ?? []) {
    const category = getCategoryByName(row.name);
    if (!category) continue;
    const draftTrim = (
      (row.memory_generated as string | null) ?? ""
    ).trim();
    const extras = extrasById.get(row.id as string);
    const isFinalized =
      draftTrim.length > 0 &&
      extras !== undefined &&
      extras.sceneCount > 0 &&
      extras.imageDraft.length > 0 &&
      extras.imageDraft === draftTrim;
    byName.set(row.name, {
      id: row.id,
      name: row.name,
      available: category.available,
      isFinalized,
    });
  }
  const folders: FolderRow[] = CATEGORIES.map((c) => byName.get(c.name)).filter(
    (f): f is FolderRow => Boolean(f),
  );

  return (
    <BrowserWindow title="새로고침" showSignOut>
      <div className="flex w-full flex-col items-center gap-12">
        <div className="text-center text-[0.9375rem] leading-relaxed text-[#503836]">
          <p>당신의 기억을 세 개의 폴더에 모아요</p>
          <p>내 인생의 한 끼, 감사한 사람, 돌아가고 싶은 시간</p>
          <p>오늘은 어떤 폴더부터 열어 볼까요?</p>
        </div>
        <FoldersGrid folders={folders} />
      </div>
    </BrowserWindow>
  );
}
