import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrowserWindow } from "@/app/_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { getCategoryByName } from "../../categories";
import { PostView } from "../_components/PostView";
import { loadPostState } from "../post-actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: folder } = await supabase
    .from("folders")
    .select("id,name")
    .eq("id", id)
    .maybeSingle();

  if (!folder) notFound();
  const category = getCategoryByName(folder.name);
  if (!category) notFound();

  const state = await loadPostState(folder.id);
  if (state.error) {
    return (
      <BrowserWindow
        title={folder.name}
        showSignOut
        fullPage
        folderId={folder.id}
        current="post"
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center text-[#503836]">
          <p className="text-sm text-[#B0413E]">{state.error}</p>
          <Link
            href={`/folders/${folder.id}/write`}
            className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA]"
          >
            글쓰기로
          </Link>
        </div>
      </BrowserWindow>
    );
  }

  return (
    <BrowserWindow
      title={folder.name}
      showSignOut
      fullPage
      folderId={folder.id}
      current="post"
    >
      <PostView
        folderId={folder.id}
        folderName={folder.name}
        draft={state.draft}
        scenes={state.scenes}
        initialUrls={state.urls}
        initialStyle={state.style}
      />
    </BrowserWindow>
  );
}
