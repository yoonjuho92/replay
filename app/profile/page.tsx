import { redirect } from "next/navigation";
import { BrowserWindow } from "../_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { findProfilePhoto } from "@/lib/profile-photo";
import { ProfilePhotoForm } from "./_components/ProfilePhotoForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existing = await findProfilePhoto(supabase, user.id);

  return (
    <BrowserWindow title="내 사진" showSignOut>
      <div className="flex w-full flex-col items-center gap-8">
        <div className="text-center text-[0.9375rem] leading-relaxed text-[#503836]">
          <h1 className="text-2xl font-bold">내 사진</h1>
          <p className="mt-3">
            이 사진은 폴더에서 그림을 만들 때 얼굴의 참고가 돼요.
          </p>
        </div>
        <ProfilePhotoForm initialPhotoUrl={existing?.publicUrl ?? null} />
      </div>
    </BrowserWindow>
  );
}
