import Link from "next/link";
import { BrowserWindow } from "../_components/BrowserWindow";
import { ForgotPasswordForm } from "./_components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <BrowserWindow title="비밀번호 재설정">
      <div className="flex w-full flex-col items-center gap-8">
        <h1 className="text-2xl font-bold text-[#503836]">비밀번호 재설정</h1>
        <p className="max-w-sm text-center text-sm leading-relaxed text-[#503836]">
          가입하신 이메일을 입력해 주세요. 비밀번호를 다시 설정할 수 있는
          링크를 보내 드릴게요.
        </p>
        <ForgotPasswordForm />
        <p className="text-sm text-[#503836]">
          비밀번호가 기억나셨나요?{" "}
          <Link href="/login" className="font-bold underline">
            로그인
          </Link>
        </p>
      </div>
    </BrowserWindow>
  );
}
