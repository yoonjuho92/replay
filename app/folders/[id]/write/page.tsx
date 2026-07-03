import Link from "next/link";
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
    return (
      <BrowserWindow
        title={folder.name}
        showSignOut
        fullPage
        folderId={folder.id}
        current="write"
      >
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex w-full max-w-[460px] flex-col items-center gap-5 rounded-md border-2 border-[#503836] bg-white p-6 text-[#503836] shadow-[4px_4px_0_#503836]">
            <p className="w-full text-[0.9375rem] leading-relaxed">
              아직 나눈 이야기가 없어요. 먼저 대화하기에서 이야기를 들려주세요.
            </p>
            <Link
              href={`/folders/${folder.id}`}
              className="rounded-md bg-[#503836] px-8 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28]"
            >
              대화하기로 가기 →
            </Link>
          </div>
        </div>
      </BrowserWindow>
    );
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
