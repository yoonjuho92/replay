import type { Metadata } from "next";
import Image from "next/image";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "새로고침",
  description: "새로고침 하시겠습니까?",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} h-full antialiased`}>
      <body className="font-sans">
        <main className="relative min-h-screen w-full overflow-hidden bg-[#FFFDC6]">
          <Image
            src="/배경.svg"
            alt=""
            aria-hidden="true"
            width={1512}
            height={982}
            preload
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-auto max-w-none"
            style={{ clipPath: "inset(0 50% 0 0)" }}
          />
          <Image
            src="/배경.svg"
            alt=""
            aria-hidden="true"
            width={1512}
            height={982}
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-auto max-w-none"
            style={{ clipPath: "inset(0 0 0 50%)" }}
          />
          <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
