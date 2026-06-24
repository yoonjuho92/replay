import { redirect } from "next/navigation";
import { BrowserWindow } from "../_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, getCategoryByName } from "./categories";
import { FoldersGrid, type FolderRow } from "./_components/FoldersGrid";

export default async function FoldersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("folders")
    .select("id,name,memory_generated")
    .eq("user_id", user.id);

  // 아는 주제(6가지)에 해당하는 폴더만 추린다.
  const myRows = (data ?? []).filter((r) => getCategoryByName(r.name as string));

  // 아직 주제 쌍을 고르지 않았으면(폴더가 없으면) 선택 화면으로 보낸다.
  if (myRows.length === 0) redirect("/folders/select");

  // Optional columns added by supabase-setup.sql. If the SQL has not been
  // run yet, this select errors and we treat every folder as not-finalized.
  const extrasById = new Map<
    string,
    { imageDraft: string; sceneCount: number }
  >();
  const folderIds = myRows.map((r) => r.id as string);
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
  for (const row of myRows) {
    const category = getCategoryByName(row.name as string);
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
    byName.set(row.name as string, {
      id: row.id as string,
      name: row.name as string,
      available: category.available,
      isFinalized,
    });
  }
  // CATEGORIES 순서대로 정렬하되, 내가 가진 폴더만 보여준다.
  const folders: FolderRow[] = CATEGORIES.map((c) => byName.get(c.name)).filter(
    (f): f is FolderRow => Boolean(f),
  );

  const folderNames = folders.map((f) => f.name).join(", ");

  return (
    <BrowserWindow title="새로고침" showSignOut>
      <div className="flex w-full flex-col items-center gap-12">
        <div className="text-center text-[0.9375rem] leading-relaxed text-[#503836]">
          <p>당신이 고른 두 가지 주제예요</p>
          <p>{folderNames}</p>
          <p>오늘은 어떤 폴더부터 열어 볼까요?</p>
        </div>
        <FoldersGrid folders={folders} />
      </div>
    </BrowserWindow>
  );
}
