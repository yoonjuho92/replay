"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "../login/actions";

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (password !== passwordConfirm) {
    return { error: "비밀번호가 일치하지 않습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // /auth/confirm 에서 복구 토큰을 검증해 세션이 생긴 상태여야 합니다.
  if (!user) {
    return {
      error:
        "재설정 세션이 만료되었어요. 비밀번호 재설정 메일을 다시 요청해 주세요.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  redirect("/folders");
}
