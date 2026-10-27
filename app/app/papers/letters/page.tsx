"use client";

import Link from "next/link";
import { ArrowRight, Copy, FileText, Inbox, Plus } from "lucide-react";
import { PageHeader, PapersNav } from "@/components/app/common";
import { Button, ButtonLink, Card, CardHeader, Empty, Pill } from "@/components/ui";
import { useToast } from "@/components/toast";
import { copyText } from "@/lib/client/links";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, isoDate } from "@/lib/dates";
import { money } from "@/lib/money";

const ROLE: Record<string, string> = { title: "Title company", lender: "Lender", attorney: "Closing attorney", agent: "Agent", seller: "Seller", buyer: "Buyer", other: "Other" };

export default function LettersPage() {
  const { road, dispatch, now } = useRoad();
  const toast = useToast();
  const incoming = road.letterRequests.filter((r) => r.status === "new");
  const letters = [...road.letters].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = isoDate(now);

  return (
    <>
      <PageHeader
        title="Votes & Papers"
        sub="Dated letters for a buyer's lender or title company, with a code they can verify."
        actions={
          <ButtonLink href="/app/papers/letters/new" icon={<Plus className="h-5 w-5" aria-hidden />}>
            New letter
          </ButtonLink>
        }
      />
      <PapersNav />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.85rem] font-semibold uppercase tracking-wide text-stone">Your road code</p>
            <p className="font-mono text-[1.6rem] font-bold">{road.code}</p>
            <p className="text-stone">Give it to a seller&apos;s title company. They request letters at /closing and you see them here.</p>
          </div>
          <Button
            variant="secondary"
            icon={<Copy className="h-5 w-5" aria-hidden />}
            onClick={async () => (await copyText(`${window.location.origin}/closing#request — road code ${road.code}`)) && toast("Copied the request link and road code.")}
          >
            Copy request link
          </Button>
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title={`Requests waiting (${incoming.length})`} icon={<Inbox className="h-5 w-5" aria-hidden />} />
        {incoming.length === 0 ? (
          <Empty title="No requests waiting" />
        ) : (
          <ul className="divide-y divide-line">
            {incoming.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{r.propertyAddress}</p>
                  <p className="text-[0.92rem] text-stone">
                    {r.requester.company || r.requester.name} · {ROLE[r.requester.role]} · asked {fmtDate(r.createdAt)}
                    {r.closingDate && <strong className="text-charcoal"> · closing {fmtDate(r.closingDate)}</strong>}
                  </p>
                  {r.note && <p className="mt-1 text-[0.92rem]">&ldquo;{r.note}&rdquo;</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "letterRequest.decline", requestId: r.id, note: "Declined by captain" }, "Declined.")}>
                    Decline
                  </Button>
                  <ButtonLink href={`/app/papers/letters/new?request=${r.id}`} size="sm" variant="warn">
                    Create letter
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Letters issued" icon={<FileText className="h-5 w-5" aria-hidden />} />
        {letters.length === 0 ? (
          <Empty title="No letters yet">Letters take about a minute. Every figure comes from the road&apos;s live records.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {letters.map((l) => (
              <li key={l.id}>
                <Link href={`/app/papers/letters/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper">
                  <span className="min-w-0">
                    <span className="block font-semibold">{l.snapshot.property.address || l.snapshot.property.label}</span>
                    <span className="block text-[0.9rem] text-stone">
                      <span className="font-mono">{l.code}</span> · for {l.requester.company || l.requester.name} · issued {fmtDate(l.createdAt)} · {money(l.fee)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Pill tone={l.validUntil >= today ? "paid" : "neutral"}>{l.validUntil >= today ? `Valid to ${fmtDate(l.validUntil)}` : "Expired"}</Pill>
                    <ArrowRight className="h-5 w-5 text-stone" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
