import Link from "next/link";
import { BrowserWindow } from "../_components/BrowserWindow";
import { SignupForm } from "../_components/SignupForm";

export default function SignupPage() {
  return (
    <BrowserWindow title="회원가입">
      <div className="flex w-full flex-col items-center gap-8">
        <h1 className="text-2xl font-bold text-[#503836]">회원가입</h1>
        <SignupForm />
        <p className="text-sm text-[#503836]">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-bold underline">
            로그인
          </Link>
        </p>
      </div>
    </BrowserWindow>
  );
}
