import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "For plow and grading contractors",
  description: "Private roads that use Road Fund collect each home's share up front and pay their contractor with one payment.",
};

export default function ContractorsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-[2.4rem] font-black leading-tight">For plow, grading and gravel contractors</h1>
      <p className="mt-4 text-[1.15rem]">
        On most private roads you deal with one neighbor, and that neighbor collects from everyone else. Road Fund helps them collect each home&apos;s share before the work,
        so your bill gets paid in one piece and on time.
      </p>

      <h2 className="mt-12 text-[1.6rem] font-black">How a job gets paid</h2>
      <ol className="mt-4 list-decimal space-y-4 pl-6 text-[1.05rem] marker:font-bold">
        <li>
          <strong>The road agrees on the price.</strong> The captain puts your quote in as the season&apos;s bill, or puts a bigger job like a culvert to a vote.
        </li>
        <li>
          <strong>Each home pays its share.</strong> Neighbors pay by bank, card or check before the work starts, and reminders go out without anyone chasing them.
        </li>
        <li>
          <strong>You send one bill.</strong> Email or hand the captain your invoice. They pay it from the road&apos;s money, and a copy stays where every neighbor can see it.
        </li>
      </ol>

      <h2 className="mt-12 text-[1.6rem] font-black">Tell the roads you work for</h2>
      <p className="mt-3">If a road keeps paying you late, or one neighbor keeps covering everyone else, send them here. It costs you nothing.</p>
      <ul className="mt-4 list-disc space-y-2 pl-6">
        <li>There&apos;s no account for you to set up. You get paid the way you already do.</li>
        <li>The captain sees who has paid before you start, so there are no surprises.</li>
        <li>Your quotes, invoices and photos stay with the road, so the next captain knows the history.</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/start">Set up a road</ButtonLink>
        <ButtonLink href="/demo" variant="secondary">
          See a sample road
        </ButtonLink>
      </div>
    </div>
  );
}
