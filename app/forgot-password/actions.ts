"use server";

import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "../login/actions";

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "이메일을 입력해 주세요." };
  }

  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://saelab.onrender.com";

  // 메일 링크는 /auth/confirm 에서 토큰을 검증한 뒤 next 경로(/reset-password)로 보냅니다.
  // 이메일 템플릿이 {{ .RedirectTo }} 를 쓰는 경우를 위해 redirectTo도 함께 넘깁니다.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  if (error) {
    return { error: "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  // 가입되지 않은 이메일이어도 동일한 안내를 보여 줍니다(계정 존재 여부 노출 방지).
  return {
    error: null,
    info: "비밀번호 재설정 링크를 메일로 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.",
  };
}
