import { redirect } from "next/navigation";
import { BrowserWindow } from "../../_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { TOPIC_PICK_COUNT, getCategoryByName } from "../categories";
import { TopicSelect } from "./_components/TopicSelect";

export default async function SelectPairPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 이미 폴더를 만든 사용자는 곧장 폴더 화면으로 보낸다(쌍 선택은 한 번만).
  const { data } = await supabase
    .from("folders")
    .select("name")
    .eq("user_id", user.id);
  const hasFolders = (data ?? []).some((r) => getCategoryByName(r.name as string));
  if (hasFolders) redirect("/folders");

  return (
    <BrowserWindow title="새로고침" showSignOut showFoldersLink={false}>
      <div className="flex w-full flex-col items-center gap-10">
        <div className="text-center text-[0.9375rem] leading-relaxed text-[#503836]">
          <p>먼저 함께 이야기 나눌 주제를 골라 주세요</p>
          <p>여섯 가지 중 {TOPIC_PICK_COUNT}가지를 고르면, 그 주제들의 폴더가 만들어져요</p>
        </div>
        <TopicSelect />
      </div>
    </BrowserWindow>
  );
}
