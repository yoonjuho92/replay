import { redirect } from "next/navigation";
import { BrowserWindow } from "../_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { FoldersGrid, type FolderRow } from "./_components/FoldersGrid";

export default async function FoldersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("folders")
    .select("id,name,memory_date")
    .order("created_at", { ascending: true });

  const folders: FolderRow[] = data ?? [];

  return (
    <BrowserWindow title="새로고침">
      <div className="flex w-full flex-col items-center gap-12">
        <div className="text-center text-[15px] leading-relaxed text-[#503836]">
          <p>당신이 가장 후회하는 기억을 폴더로 만들어요</p>
          <p>한 폴더에 한 기억씩 총 다섯 개의 폴더를 만들 수 있어요</p>
          <p>만약, 과거로 돌아가 그때의 선택을 되돌릴 수 있다면 어떨까요?</p>
        </div>
        <FoldersGrid folders={folders} />
      </div>
    </BrowserWindow>
  );
}
