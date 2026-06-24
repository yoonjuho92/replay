import Link from "next/link";
import { BrowserWindow } from "../_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./_components/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <BrowserWindow title="비밀번호 재설정">
      <div className="flex w-full flex-col items-center gap-8">
        <h1 className="text-2xl font-bold text-[#503836]">새 비밀번호 설정</h1>
        {user ? (
          <>
            <p className="max-w-sm text-center text-sm leading-relaxed text-[#503836]">
              새로 사용할 비밀번호를 입력해 주세요.
            </p>
            <ResetPasswordForm />
          </>
        ) : (
          <>
            <p className="max-w-sm text-center text-sm leading-relaxed text-[#503836]">
              재설정 링크가 만료되었거나 올바르지 않아요. 비밀번호 재설정
              메일을 다시 요청해 주세요.
            </p>
            <Link
              href="/forgot-password"
              className="rounded-md bg-[#503836] px-8 py-2 text-base font-bold text-white transition-colors hover:bg-[#3d2a28]"
            >
              재설정 메일 다시 받기
            </Link>
          </>
        )}
      </div>
    </BrowserWindow>
  );
}
