"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { PageHeader, PlanGate, RoadNav } from "@/components/app/common";
import { Button, Card, Checkbox, Dialog, Empty, Field, Input, Pill, Textarea } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { addDays, fmtDate, isoDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import type { Bid } from "@/lib/types";

export default function BidsPage() {
  const { road } = useRoad();
  const [creating, setCreating] = useState(false);
  const bids = [...road.bids].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <PageHeader
        title="Road"
        sub="Send one request to several contractors and compare their quotes side by side."
        actions={
          <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setCreating(true)}>
            Ask for bids
          </Button>
        }
      />
      <RoadNav />
      <PlanGate needs="roadfund" feature="Contractor bids" pitch="Write the job once, collect quotes from several contractors, and line them up by price, scope, warranty and timing.">
        {bids.length === 0 ? (
          <Card>
            <Empty title="No bids yet" action={<Button onClick={() => setCreating(true)}>Ask for bids</Button>}>
              Getting two or three quotes before a big job is the easiest way to show neighbors the price is fair.
            </Empty>
          </Card>
        ) : (
          <ul className="space-y-3">
            {bids.map((b) => {
              const low = b.quotes.length ? Math.min(...b.quotes.map((q) => q.amount)) : null;
              const won = b.quotes.find((q) => q.id === b.awardedQuoteId);
              return (
                <li key={b.id}>
                  <Link href={`/app/road/bids/${b.id}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-card hover:border-field">
                    <div>
                      <p className="text-[1.1rem] font-bold">{b.title}</p>
                      <p className="text-stone">
                        {b.quotes.length} quote{b.quotes.length === 1 ? "" : "s"}
                        {low !== null && ` · lowest ${money(low)}`}
                        {won && ` · picked ${won.vendorName}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={b.status === "open" ? "info" : b.status === "awarded" ? "paid" : "neutral"}>{b.status === "open" ? "Collecting quotes" : b.status === "awarded" ? "Picked" : "Closed"}</Pill>
                      <ArrowRight className="h-5 w-5 text-stone" aria-hidden />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PlanGate>
      {creating && <NewBidDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function NewBidDialog({ onClose }: { onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [replyBy, setReplyBy] = useState(addDays(isoDate(), 14));
  const [ids, setIds] = useState<string[]>(road.contractors.filter((c) => !/insur/i.test(c.trade)).map((c) => c.id));
  const save = async () => {
    const bid: Bid = { id: uid("bid"), title: title.trim(), scope: scope.trim(), createdAt: new Date().toISOString(), replyBy, contractorIds: ids, quotes: [], status: "open", awardedQuoteId: null, voteId: null };
    if (await dispatch({ type: "bid.save", bid }, "Bid request created.")) router.push(`/app/road/bids/${bid.id}`);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Ask for bids"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Job" htmlFor="bid-title">
          <Input id="bid-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Regrade the full road and add 40 tons of gravel" />
        </Field>
        <Field label="What exactly you want done" hint="The same scope for everyone makes quotes comparable." htmlFor="bid-scope">
          <Textarea id="bid-scope" value={scope} onChange={(e) => setScope(e.target.value)} rows={4} />
        </Field>
        <Field label="Quotes due by" htmlFor="bid-due" hint={fmtDate(replyBy)}>
          <Input id="bid-due" type="date" value={replyBy} onChange={(e) => setReplyBy(e.target.value)} />
        </Field>
        {road.contractors.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 font-semibold">Who to ask</legend>
            {road.contractors.map((c) => (
              <Checkbox key={c.id} checked={ids.includes(c.id)} onChange={(v) => setIds(v ? [...ids, c.id] : ids.filter((x) => x !== c.id))} label={c.name} hint={c.trade} />
            ))}
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}
