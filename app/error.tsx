"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <LogoMark className="h-12 w-12" />
      <h1 className="text-[2rem] font-black leading-tight">Something went wrong on this page</h1>
      <p className="text-[1.05rem] text-stone">Your road&apos;s records are safe. Try again, and if it keeps happening, reload the page or come back in a few minutes.</p>
      <div className="mt-2 grid gap-2">
        <button onClick={reset} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-pine px-5 font-bold text-white hover:bg-pine-dark">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-line bg-white px-5 font-bold hover:border-field">
          Road Fund home
        </Link>
      </div>
      {error.digest && <p className="text-[0.85rem] text-stone">Reference: {error.digest}</p>}
    </main>
  );
}
