"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PROFILE_BUCKET,
  findProfilePhoto,
  uploadProfilePhoto,
} from "@/lib/profile-photo";

export type ProfilePhotoState = {
  error: string | null;
  info: string | null;
};

export async function uploadProfilePhotoAction(
  _prev: ProfilePhotoState,
  formData: FormData,
): Promise<ProfilePhotoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "사진을 골라 주세요.", info: null };
  }

  const result = await uploadProfilePhoto(supabase, user.id, photo);
  if (result.error) {
    return { error: result.error, info: null };
  }

  revalidatePath("/profile");
  return { error: null, info: "사진을 저장했어요." };
}

export async function deleteProfilePhotoAction(): Promise<ProfilePhotoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existing = await findProfilePhoto(supabase, user.id);
  if (!existing) {
    return { error: null, info: "사진이 없었어요." };
  }
  const { error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .remove([existing.path]);
  if (error) {
    return { error: `삭제 실패: ${error.message}`, info: null };
  }
  revalidatePath("/profile");
  return { error: null, info: "사진을 지웠어요." };
}
