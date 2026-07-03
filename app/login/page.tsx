import Link from "next/link";
import { BrowserWindow } from "../_components/BrowserWindow";
import { AuthForm } from "../_components/AuthForm";
import { loginAction } from "./actions";

export default function LoginPage() {
  return (
    <BrowserWindow title="로그인" centerContent>
      <div className="flex w-full flex-col items-center gap-8">
        <h1 className="text-2xl font-bold text-[#503836]">로그인</h1>
        <AuthForm action={loginAction} submitLabel="로그인" />
        <div className="flex flex-col items-center gap-2 text-sm text-[#503836]">
          <p>
            계정이 없으신가요?{" "}
            <Link href="/signup" className="font-bold underline">
              회원가입
            </Link>
          </p>
          <p>
            비밀번호를 잊으셨나요?{" "}
            <Link href="/forgot-password" className="font-bold underline">
              비밀번호 재설정
            </Link>
          </p>
        </div>
      </div>
    </BrowserWindow>
  );
}
