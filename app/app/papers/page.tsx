"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus, Vote } from "lucide-react";
import { PageHeader, PapersNav, PlanGate } from "@/components/app/common";
import { AmountInput } from "@/components/amount-input";
import { Button, Card, Choice, Dialog, Empty, Field, Input, Pill, Progress, Textarea } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { addDays, fmtDate, isoDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import { THRESHOLD_TEXT, voteState } from "@/lib/selectors";
import type { Vote as VoteT, VoteKind } from "@/lib/types";

export default function VotesPage() {
  const { road, now } = useRoad();
  const [creating, setCreating] = useState(false);
  const states = road.votes.map((v) => voteState(road, v, now));
  const open = states.filter((s) => s.status === "open" || s.status === "ready");
  const past = states.filter((s) => s.status === "passed" || s.status === "failed");
  return (
    <>
      <PageHeader
        title="Votes & Papers"
        sub="Decisions with a deadline and a permanent record, plus the road's agreement, letters and documents."
        actions={
          <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setCreating(true)}>
            Start a vote
          </Button>
        }
      />
      <PapersNav />
      <PlanGate needs="roadfund" feature="Votes" pitch="Ask “Grade in spring for $2,400?” and neighbors answer yes or no from a link. Deadline, tally and a permanent record included.">
        <h2 className="mb-3 text-[1.25rem] font-extrabold">Open</h2>
        {open.length === 0 ? (
          <Card className="mb-8">
            <Empty icon={<Vote className="h-6 w-6" aria-hidden />} title="No open votes" />
          </Card>
        ) : (
          <ul className="mb-8 space-y-3">
            {open.map((s) => (
              <li key={s.vote.id}>
                <Link href={`/app/papers/votes/${s.vote.id}`} className="block rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-card hover:border-field">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[1.1rem] font-bold">{s.vote.question}</p>
                    <ArrowRight className="h-5 w-5 shrink-0 text-stone" aria-hidden />
                  </div>
                  <p className="mt-1 text-stone">
                    {s.yes} yes · {s.no} no · {s.waiting} not voted · needs {s.needed} yes · {s.status === "ready" ? "voting ended, ready to close" : `ends ${fmtDate(s.vote.deadline)}`}
                  </p>
                  <div className="mt-3">
                    <Progress value={s.yes} max={s.needed} label="Yes votes toward passing" />
                  </div>
                  {s.decided && <p className="mt-2 text-[0.92rem] font-semibold text-pine">{s.decided === "pass" ? "Enough yes votes to pass." : "Can't pass anymore."}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <h2 className="mb-3 text-[1.25rem] font-extrabold">Decided</h2>
        {past.length === 0 ? (
          <p className="text-stone">Closed votes show here with their final tally.</p>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {past.map((s) => (
                <li key={s.vote.id}>
                  <Link href={`/app/papers/votes/${s.vote.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper">
                    <span>
                      <span className="block font-semibold">{s.vote.question}</span>
                      <span className="block text-[0.9rem] text-stone">
                        {s.yes} yes, {s.no} no · closed {s.vote.closedAt ? fmtDate(s.vote.closedAt) : ""}
                      </span>
                    </span>
                    <Pill tone={s.status === "passed" ? "paid" : "late"}>{s.status === "passed" ? "Passed" : "Failed"}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PlanGate>
      {creating && <NewVoteDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function NewVoteDialog({ onClose }: { onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const router = useRouter();
  const t = road.agreement.terms;
  const [kind, setKind] = useState<VoteKind>("repair");
  const [question, setQuestion] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState(0);
  const [deadline, setDeadline] = useState(addDays(isoDate(), 7));
  const threshold = kind === "repair" ? t.repairThreshold : kind === "improvement" ? t.improvementThreshold : kind === "agreement" ? "two-thirds" : "majority";
  const save = async () => {
    const vote: VoteT = { id: uid("vote"), kind, question: question.trim(), detail: detail.trim(), amount: amount || null, createdAt: new Date().toISOString(), deadline, threshold, ballots: [], closedAt: null, outcome: null, bidId: null };
    if (await dispatch({ type: "vote.create", vote }, "Vote started.")) router.push(`/app/papers/votes/${vote.id}?send=1`);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Start a vote"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!question.trim()}>
            Start vote
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Choice
          name="vote-kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "repair", label: "Repair or upkeep", hint: `Grading, gravel, culverts. Needs: ${THRESHOLD_TEXT[t.repairThreshold].toLowerCase()}.` },
            { value: "improvement", label: "Upgrade", hint: `Paving, widening, lights. Needs: ${THRESHOLD_TEXT[t.improvementThreshold].toLowerCase()}.` },
            { value: "agreement", label: "Change the agreement", hint: "Needs two-thirds of all homes." },
            { value: "other", label: "Something else", hint: "Needs more than half of all homes." },
          ]}
        />
        <Field label="Question" hint="Yes-or-no, with the amount if there is one." htmlFor="v-q">
          <Input id="v-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Grade the road in May for $2,400?" />
        </Field>
        <Field label="Details" optional htmlFor="v-d">
          <Textarea id="v-d" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" optional htmlFor="v-amt">
            <AmountInput id="v-amt" value={amount} onChange={setAmount} />
          </Field>
          <Field label="Voting ends" htmlFor="v-dl">
            <Input id="v-dl" type="date" value={deadline} min={isoDate()} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
        <p className="text-[0.92rem] text-stone">Counted against all {road.homes.length} homes, not just those who vote, so silence never passes anything.</p>
      </div>
    </Dialog>
  );
}
