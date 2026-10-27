import type { Metadata } from "next";
import { VerifyForm } from "@/components/closing-forms";

export const metadata: Metadata = { title: "Verify a Road Status Letter" };

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-[2.2rem] font-black">Verify a Road Status Letter</h1>
      <p className="mt-3 text-[1.05rem] text-stone">Enter the code printed on the letter to confirm it was issued by the road and see when it expires.</p>
      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
        <VerifyForm />
      </div>
    </div>
  );
}
