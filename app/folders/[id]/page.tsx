import { notFound, redirect } from "next/navigation";
import { BrowserWindow } from "@/app/_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { AgentChat } from "./_components/AgentChat";
import { ChangeTopicButton } from "./_components/ChangeTopicButton";
import { CATEGORIES, getCategoryByName } from "../categories";
import { generateChatOpener } from "./agent-actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MemoryPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: folder } = await supabase
    .from("folders")
    .select("id,name,memory_inputs")
    .eq("id", id)
    .maybeSingle();

  if (!folder) notFound();
  const category = getCategoryByName(folder.name);
  if (!category) notFound();

  if (!category.available) {
    return (
      <BrowserWindow title={folder.name} showSignOut>
        <div className="flex w-full flex-col items-center gap-6 text-center text-[#503836]">
          <p className="text-[0.9375rem] leading-relaxed">
            이 폴더는 아직 준비 중이에요.
            <br />
            곧 함께 풀어볼 수 있도록 만들고 있어요.
          </p>
        </div>
      </BrowserWindow>
    );
  }

  const initialGreeting = await generateChatOpener(folder.id);

  // 바꿀 수 있는 주제 = 준비된 주제 중 내가 아직 폴더로 갖고 있지 않은 것.
  const { data: myFolders } = await supabase
    .from("folders")
    .select("name")
    .eq("user_id", user.id);
  const heldNames = new Set((myFolders ?? []).map((f) => f.name as string));
  const topicOptions = CATEGORIES.filter(
    (c) => c.available && !heldNames.has(c.name),
  ).map((c) => c.name);

  return (
    <BrowserWindow
      title={folder.name}
      showSignOut
      fill
      folderId={folder.id}
      current="chat"
    >
      <div className="flex h-full min-h-0 w-full flex-col gap-3">
        <div className="flex shrink-0 items-center justify-end">
          <ChangeTopicButton
            folderId={folder.id}
            currentName={folder.name}
            options={topicOptions}
          />
        </div>
        <div className="min-h-0 flex-1">
          <AgentChat folderId={folder.id} initialGreeting={initialGreeting} />
        </div>
      </div>
    </BrowserWindow>
  );
}
