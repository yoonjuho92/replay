"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadProfilePhoto } from "@/lib/profile-photo";
import type { AuthFormState } from "../login/actions";

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const photo = formData.get("photo");
  const photoFile = photo instanceof File && photo.size > 0 ? photo : null;

  if (!email || !password || !passwordConfirm) {
    return { error: "이메일과 비밀번호를 입력해 주세요." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (password !== passwordConfirm) {
    return { error: "비밀번호가 일치하지 않습니다." };
  }

  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://saelab.onrender.com";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user && data.user.identities?.length === 0) {
    return { error: "이미 가입된 이메일이에요." };
  }

  if (data.session && data.user) {
    if (photoFile) {
      const result = await uploadProfilePhoto(
        supabase,
        data.user.id,
        photoFile,
      );
      if (result.error) {
        return {
          error: null,
          info: `가입은 완료됐지만 사진 저장에 실패했어요 (${result.error}). 프로필 페이지에서 다시 올려 주세요.`,
        };
      }
    }
    redirect("/folders");
  }

  return {
    error: null,
    info: photoFile
      ? "이메일로 인증 링크를 보냈어요. 메일함에서 링크를 누른 뒤, 프로필 페이지에서 사진을 다시 올려 주세요."
      : "이메일로 인증 링크를 보냈어요. 메일함에서 링크를 눌러 가입을 완료해 주세요.",
  };
}
