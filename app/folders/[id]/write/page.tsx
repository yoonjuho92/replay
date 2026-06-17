import { notFound, redirect } from "next/navigation";
import { BrowserWindow } from "@/app/_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { getCategoryByName, hasStory } from "../../categories";
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

  if (!hasStory(folder.memory_inputs)) {
    redirect(`/folders/${folder.id}`);
  }

  const initialDraft = (folder.memory_generated as string | null) ?? "";

  const opener = await generateCoachOpener(folder.id);
  const initialGreeting =
    opener.text ||
    `안녕하세요. 여기서부터는 당신이 직접 글을 써 보세요. 첫 문장이 막막하다면 "첫 문장 도와줘" 라고 말해 주세요.`;

  return (
    <BrowserWindow
      title={folder.name}
      showSignOut
      fullPage
      hideTitleBar
      folderId={folder.id}
      current="write"
    >
      <WritingWorkspace
        folderId={folder.id}
        initialDraft={initialDraft}
        initialGreeting={initialGreeting}
      />
    </BrowserWindow>
  );
}
