import Link from "next/link";
import { BrowserWindow } from "../_components/BrowserWindow";
import { AuthForm } from "../_components/AuthForm";
import { loginAction } from "./actions";

export default function LoginPage() {
  return (
    <BrowserWindow title="로그인">
      <div className="flex w-full flex-col items-center gap-8">
        <h1 className="text-2xl font-bold text-[#503836]">로그인</h1>
        <AuthForm action={loginAction} submitLabel="로그인" />
        <p className="text-sm text-[#503836]">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-bold underline">
            회원가입
          </Link>
        </p>
      </div>
    </BrowserWindow>
  );
}
