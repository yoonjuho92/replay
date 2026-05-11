import { notFound, redirect } from "next/navigation";
import { BrowserWindow } from "@/app/_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import {
  getCategoryByName,
  isAllFilled,
  normalizeAnswers,
} from "../../categories";
import { generateCoachOpener } from "../agent-actions";
import { WritingWorkspace } from "../_components/WritingWorkspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function WritePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: folder } = await supabase
    .from("folders")
    .select("id,name,memory_inputs,memory_generated")
    .eq("id", id)
    .maybeSingle();

  if (!folder) notFound();
  const category = getCategoryByName(folder.name);
  if (!category) notFound();
  if (!category.available) redirect(`/folders/${folder.id}`);

  const answers = normalizeAnswers(
    category,
    (folder.memory_inputs ?? {}) as Record<string, unknown>,
  );

  if (!isAllFilled(category, answers)) {
    redirect(`/folders/${folder.id}`);
  }

  const initialDraft = (folder.memory_generated as string | null) ?? "";

  // image_draft / image_scenes are added by supabase-setup.sql. If the SQL has
  // not been run yet, this query errors and we treat the plan as missing.
  let existingImageDraft: string | null = null;
  let existingSceneCount = 0;
  const { data: extras } = await supabase
    .from("folders")
    .select("image_draft, image_scenes")
    .eq("id", id)
    .maybeSingle();
  if (extras) {
    existingImageDraft = (extras.image_draft as string | null) ?? null;
    const scenes = (extras.image_scenes as unknown[] | null) ?? null;
    existingSceneCount = Array.isArray(scenes) ? scenes.length : 0;
  }

  const opener = await generateCoachOpener(folder.id);
  const initialGreeting =
    opener.text ||
    `안녕하세요. 여기서부터는 당신이 직접 글을 써 보세요. 첫 문장이 막막하다면 "첫 문장 도와줘" 라고 말해 주세요.`;

  return (
    <BrowserWindow title="새로고침" showSignOut fill>
      <WritingWorkspace
        folderId={folder.id}
        folderName={folder.name}
        initialDraft={initialDraft}
        initialGreeting={initialGreeting}
        hasExistingImage={existingSceneCount > 0}
        existingImageDraft={existingImageDraft}
      />
    </BrowserWindow>
  );
}
