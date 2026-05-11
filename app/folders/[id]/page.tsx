import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrowserWindow } from "@/app/_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { getCategoryByName, normalizeAnswers } from "../categories";
import { MemoryForm } from "./_components/MemoryForm";

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
      <BrowserWindow title="새로고침" showSignOut>
        <div className="flex w-full flex-col items-center gap-6 text-center text-[#503836]">
          <h1 className="text-2xl font-bold leading-snug">
            <span className="text-[#5DBFA8]">{folder.name}</span>
          </h1>
          <p className="text-[15px] leading-relaxed">
            이 폴더는 아직 준비 중이에요.
            <br />
            곧 함께 풀어볼 수 있도록 만들고 있어요.
          </p>
          <Link
            href="/folders"
            className="rounded-md border-2 border-[#503836] bg-white px-6 py-2 text-base font-bold text-[#503836] transition-colors hover:bg-[#F3F7FA]"
          >
            폴더로 돌아가기
          </Link>
        </div>
      </BrowserWindow>
    );
  }

  const answers = normalizeAnswers(
    category,
    (folder.memory_inputs ?? {}) as Record<string, unknown>,
  );

  return (
    <BrowserWindow title="새로고침" showSignOut>
      <div className="flex w-full flex-col gap-6">
        <MemoryForm
          folderId={folder.id}
          folderName={folder.name}
          category={category}
          initialAnswers={answers}
        />
      </div>
    </BrowserWindow>
  );
}
