import type { Metadata } from "next";
import { VerifyResult } from "@/components/verify-result";

export const metadata: Metadata = { title: "Letter verification", robots: { index: false } };

export default async function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-[2.2rem] font-black">Letter verification</h1>
      <VerifyResult code={decodeURIComponent(code)} />
    </div>
  );
}
