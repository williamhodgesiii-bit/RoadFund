"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Plus, Sparkles, Trash2, Trophy, Vote } from "lucide-react";
import { AiBadge, PageHeader, useAiOn } from "@/components/app/common";
import { AmountInput } from "@/components/amount-input";
import { Button, Callout, Card, CardHeader, cx, Dialog, Empty, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ai } from "@/lib/client/backend";
import { mailtoHref } from "@/lib/client/links";
import { useRoad } from "@/lib/client/road-context";
import { addDays, fmtDate, isoDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import type { Quote, Vote as VoteT } from "@/lib/types";

interface Comparison {
  summary: string;
  rows: { vendor: string; matchesScope: string; watchOut: string }[];
}

export default function BidPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { road, dispatch } = useRoad();
  const toast = useToast();
  const aiOn = useAiOn();
  const bid = road.bids.find((b) => b.id === id);
  const [adding, setAdding] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [award, setAward] = useState<Quote | null>(null);

  if (!bid) return <Card><Empty title="Bid not found" /></Card>;
  const sorted = [...bid.quotes].sort((a, b) => a.amount - b.amount);
  const low = sorted[0]?.amount ?? 0;
  const invited = road.contractors.filter((c) => bid.contractorIds.includes(c.id));

  const compare = async () => {
    setComparing(true);
    const res = await ai<Comparison>({
      task: "quotes",
      job: bid.title,
      scope: bid.scope,
      quotes: bid.quotes.map((q) => ({ vendor: q.vendorName, amount: money(q.amount), scope: q.scope, warranty: q.warranty, startBy: q.startBy ? fmtDate(q.startBy) : "" })),
    });
    setComparing(false);
    if (res.ok && res.data) setComparison(res.data);
    else toast(res.error ?? "Couldn't compare.", "error");
  };

  const askEmail = (email: string, name: string) =>
    mailtoHref(email, `Quote request: ${bid.title} (${road.name})`, `Hi ${name},\n\n${road.name} would like a quote for:\n\n${bid.title}\n${bid.scope}\n\nPlease reply by ${bid.replyBy ? fmtDate(bid.replyBy) : "two weeks from today"} with a price, what's included, warranty, and when you could start.\n\nThanks,\n${road.homes.find((h) => h.id === road.captainHomeId)?.owners ?? "Road captain"}`);

  return (
    <>
      <PageHeader
        back={{ href: "/app/road/bids", label: "Bids" }}
        title={bid.title}
        sub={`${bid.quotes.length} quote${bid.quotes.length === 1 ? "" : "s"}${bid.replyBy ? ` · due ${fmtDate(bid.replyBy)}` : ""}`}
        actions={
          <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setAdding(true)}>
            Add a quote
          </Button>
        }
      />
      {bid.scope && <p className="mb-5 rounded-xl bg-white p-4 shadow-card">{bid.scope}</p>}

      {invited.length > 0 && bid.status === "open" && (
        <Card className="mb-5">
          <CardHeader title="Ask contractors" sub="Opens your email with the job filled in." />
          <ul className="flex flex-wrap gap-2 p-4">
            {invited.map((c) => (
              <li key={c.id}>
                {c.email ? (
                  <a href={askEmail(c.email, c.name)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-line bg-white px-3 font-semibold hover:border-field">
                    <Mail className="h-4 w-4" aria-hidden /> {c.name}
                  </a>
                ) : (
                  <span className="inline-flex min-h-10 items-center rounded-lg bg-paper px-3 text-stone">{c.name}: no email</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sorted.length === 0 ? (
        <Card>
          <Empty title="No quotes yet" action={<Button onClick={() => setAdding(true)}>Add a quote</Button>}>
            Type in each quote as it arrives.
          </Empty>
        </Card>
      ) : (
        <Card className="mb-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-line bg-paper text-[0.88rem] text-stone">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Contractor</th>
                <th className="px-3 py-2.5 text-right font-semibold">Price</th>
                <th className="px-3 py-2.5 font-semibold">What&apos;s included</th>
                <th className="px-3 py-2.5 font-semibold">Warranty</th>
                <th className="px-3 py-2.5 font-semibold">Can start</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {sorted.map((q) => {
                const won = bid.awardedQuoteId === q.id;
                return (
                  <tr key={q.id} className={cx(won && "bg-pine-50/60")}>
                    <td className="px-5 py-3 font-semibold">
                      {q.vendorName}
                      {won && (
                        <span className="mt-1 flex items-center gap-1 text-[0.85rem] text-pine">
                          <Trophy className="h-4 w-4" aria-hidden /> Picked
                        </span>
                      )}
                    </td>
                    <td className="tnum px-3 py-3 text-right font-bold">
                      {money(q.amount)}
                      {q.amount === low && sorted.length > 1 && <span className="block text-[0.8rem] font-semibold text-pine">lowest</span>}
                      {q.amount !== low && <span className="block text-[0.8rem] font-normal text-stone">+{money(q.amount - low)}</span>}
                    </td>
                    <td className="px-3 py-3 text-[0.92rem]">{q.scope || "—"}</td>
                    <td className="px-3 py-3 text-[0.92rem]">{q.warranty || "—"}</td>
                    <td className="px-3 py-3 text-[0.92rem]">{q.startBy ? fmtDate(q.startBy) : "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {bid.status === "open" && (
                          <Button size="sm" onClick={() => setAward(q)}>
                            Pick
                          </Button>
                        )}
                        <button className="rounded-lg p-2 text-stone hover:bg-brick-50 hover:text-brick" aria-label={`Remove ${q.vendorName}`} onClick={() => dispatch({ type: "bid.removeQuote", bidId: bid.id, quoteId: q.id })}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {bid.quotes.length >= 2 && aiOn && (
        <Card className="mb-5">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Line up the differences <AiBadge />
              </span>
            }
            sub="Points out scope, materials and warranty gaps. It never picks a winner; you and your neighbors do."
            action={
              <Button size="sm" variant="secondary" loading={comparing} icon={<Sparkles className="h-4 w-4" aria-hidden />} onClick={compare}>
                {comparison ? "Compare again" : "Compare"}
              </Button>
            }
          />
          {comparison && (
            <div className="space-y-3 p-5">
              <p>{comparison.summary}</p>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {comparison.rows.map((r) => (
                  <li key={r.vendor} className="px-4 py-3">
                    <p className="font-semibold">{r.vendor}</p>
                    <p className="text-[0.92rem]">{r.matchesScope}</p>
                    <p className="text-[0.92rem] text-stone">Ask about: {r.watchOut}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {bid.voteId && (
        <Callout tone="info" title="This job went to a vote" action={<Button size="sm" variant="secondary" icon={<Vote className="h-4 w-4" aria-hidden />} onClick={() => router.push(`/app/papers/votes/${bid.voteId}`)}>Open the vote</Button>}>
          Neighbors decide before work starts.
        </Callout>
      )}

      {adding && <QuoteDialog bidId={bid.id} onClose={() => setAdding(false)} />}
      {award && (
        <Dialog
          open
          onClose={() => setAward(null)}
          title={`Pick ${award.vendorName}?`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAward(null)}>
                Cancel
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (await dispatch({ type: "bid.award", bidId: bid.id, quoteId: award.id, voteId: null }, `Picked ${award.vendorName}.`)) setAward(null);
                }}
              >
                Pick without a vote
              </Button>
              <Button
                icon={<Vote className="h-5 w-5" aria-hidden />}
                onClick={async () => {
                  const vote: VoteT = {
                    id: uid("vote"),
                    kind: /pav|widen|light/i.test(bid.title) ? "improvement" : "repair",
                    question: `${bid.title} with ${award.vendorName} for ${money(award.amount)}?`,
                    detail: `${sorted.length} quotes received; ${award.amount === low ? "this is the lowest" : `lowest was ${money(low)}`}. Scope: ${award.scope || bid.scope}`,
                    amount: award.amount,
                    createdAt: new Date().toISOString(),
                    deadline: addDays(isoDate(), 7),
                    threshold: /pav|widen|light/i.test(bid.title) ? road.agreement.terms.improvementThreshold : road.agreement.terms.repairThreshold,
                    ballots: [],
                    closedAt: null,
                    outcome: null,
                    bidId: bid.id,
                  };
                  if (await dispatch([{ type: "bid.award", bidId: bid.id, quoteId: award.id, voteId: vote.id }, { type: "vote.create", vote }], "Vote started.")) router.push(`/app/papers/votes/${vote.id}?send=1`);
                }}
              >
                Pick and start a vote
              </Button>
            </>
          }
        >
          <p>
            {money(award.amount)}
            {award.amount !== low && ` (${money(award.amount - low)} more than the lowest)`}. Most road agreements need a vote before spending on a repair this size. A vote
            also gives you a record if anyone asks later.
          </p>
        </Dialog>
      )}
    </>
  );
}

function QuoteDialog({ bidId, onClose }: { bidId: string; onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const [contractorId, setContractorId] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState(0);
  const [scope, setScope] = useState("");
  const [warranty, setWarranty] = useState("");
  const [startBy, setStartBy] = useState("");
  const save = async () => {
    const name = contractorId ? road.contractors.find((c) => c.id === contractorId)!.name : vendor;
    const quote: Quote = { id: uid("quo"), contractorId: contractorId || null, vendorName: name, amount, startBy: startBy || null, scope, warranty, receivedAt: new Date().toISOString() };
    if (await dispatch({ type: "bid.quote", bidId, quote }, "Quote added.")) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a quote"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={amount <= 0 || !(contractorId || vendor.trim())}>
            Add quote
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="q-ctr">
          <Select id="q-ctr" value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
            <option value="">Someone else…</option>
            {road.contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {!contractorId && (
          <Field label="Contractor name" htmlFor="q-vendor">
            <Input id="q-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
        )}
        <Field label="Price" htmlFor="q-amount">
          <AmountInput id="q-amount" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Can start by" optional htmlFor="q-start">
          <Input id="q-start" type="date" value={startBy} onChange={(e) => setStartBy(e.target.value)} />
        </Field>
        <Field label="Warranty" optional htmlFor="q-war">
          <Input id="q-war" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="1 year" />
        </Field>
        <Field label="What's included" className="sm:col-span-2" htmlFor="q-scope">
          <Textarea id="q-scope" rows={3} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Materials, sizes, cleanup" />
        </Field>
      </div>
    </Dialog>
  );
}
