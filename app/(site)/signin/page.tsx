import type { Metadata } from "next";
import { SignInForm } from "@/components/signin-form";

export const metadata: Metadata = {
  title: "Captain sign-in",
  description: "Sign in to your road on a new phone or computer with a one-time link sent to your email.",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-[2.2rem] font-black leading-tight">Captain sign-in</h1>
      <p className="mt-2 text-[1.05rem] text-stone">New phone or computer? We&apos;ll email you a link that opens your road. No password.</p>
      <div className="mt-8">
        <SignInForm />
      </div>
    </div>
  );
}
