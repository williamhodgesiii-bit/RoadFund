import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <LogoMark className="h-12 w-12" />
      <h1 className="text-[2rem] font-black leading-tight">That page isn&apos;t here</h1>
      <p className="text-[1.05rem] text-stone">The address may have a typo, or the page moved. If you came from a text or email about your road, ask your road captain to send the link again.</p>
      <div className="mt-2 grid gap-2">
        <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-pine px-5 font-bold text-white hover:bg-pine-dark">
          Road Fund home
        </Link>
        <Link href="/help" className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-line bg-white px-5 font-bold hover:border-field">
          Help
        </Link>
      </div>
    </main>
  );
}
