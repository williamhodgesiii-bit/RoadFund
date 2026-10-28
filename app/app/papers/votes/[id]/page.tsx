"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, CircleMinus, Send, X } from "lucide-react";
import { PageHeader } from "@/components/app/common";
import { SendSheet } from "@/components/app/send-sheet";
import { Button, ButtonLink, Callout, Card, CardHeader, Empty, Pill, Progress, Select, cx } from "@/components/ui";
import { voteRecipients } from "@/lib/client/recipients";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { money } from "@/lib/money";
import { displayName, THRESHOLD_TEXT, voteState } from "@/lib/selectors";
import type { Ballot } from "@/lib/types";

export default function VotePage() {
  const { id } = useParams<{ id: string }>();
  const { road, dispatch, now } = useRoad();
  const vote = road.votes.find((v) => v.id === id);
  const autoSend = useSearchParams().get("send") === "1";
  const [sending, setSending] = useState(() => !!vote && autoSend);
  useEffect(() => {
    if (autoSend) window.history.replaceState(null, "", window.location.pathname);
  }, [autoSend]);
  if (!vote) return <Card><Empty title="Vote not found" /></Card>;
  const s = voteState(road, vote, now);
  const open = s.status === "open";

  const record = (homeId: string, choice: Ballot["choice"], via: Ballot["via"]) =>
    dispatch({ type: "vote.cast", voteId: vote.id, ballot: { homeId, choice, via, at: new Date().toISOString() } }, "Vote recorded.");

  return (
    <>
      <PageHeader
        back={{ href: "/app/papers", label: "Votes" }}
        title={vote.question}
        sub={`${THRESHOLD_TEXT[vote.threshold]} must vote yes (${s.needed} of ${s.eligible}) · ${s.status === "open" ? `ends ${fmtDate(vote.deadline)}` : s.status === "ready" ? `ended ${fmtDate(vote.deadline)}` : `closed ${fmtDate(vote.closedAt!)}`}`}
        actions={
          open ? (
            <Button icon={<Send className="h-5 w-5" aria-hidden />} onClick={() => setSending(true)} disabled={s.waiting === 0}>
              Send vote links
            </Button>
          ) : undefined
        }
      />
      {s.status === "passed" && (
        <Callout
          tone="ok"
          className="mb-5"
          title={`Passed ${s.yes} to ${s.no}`}
          action={
            vote.amount && !vote.requestId ? (
              <ButtonLink href={`/app/money/requests/new?vote=${vote.id}`}>Bill each home its share</ButtonLink>
            ) : vote.requestId ? (
              <ButtonLink href={`/app/money/requests/${vote.requestId}`} variant="secondary">
                See the project bill
              </ButtonLink>
            ) : undefined
          }
        >
          Recorded on {fmtDateTime(vote.closedAt!)}.
          {vote.amount && !vote.requestId ? " Collect each home's share before the work starts, then pay the contractor from it." : ""}
        </Callout>
      )}
      {s.status === "failed" && <Callout tone="danger" className="mb-5" title={`Did not pass: ${s.yes} yes, needed ${s.needed}`}>Recorded on {fmtDateTime(vote.closedAt!)}.</Callout>}
      {(s.status === "ready" || (open && s.decided)) && (
        <Callout
          tone={s.decided === "pass" || (s.status === "ready" && s.yes >= s.needed) ? "ok" : "warn"}
          className="mb-5"
          title={s.status === "ready" ? "Voting has ended" : s.decided === "pass" ? "It has enough yes votes to pass" : "It can't pass anymore"}
          action={<Button onClick={() => dispatch({ type: "vote.close", voteId: vote.id }, "Vote closed and recorded.")}>Close and record the result</Button>}
        >
          {s.status === "ready" ? "Close it to record the result." : "You can close it early; the result can't change."}
        </Callout>
      )}

      <Card className="mb-6 p-5">
        {vote.detail && <p className="mb-4">{vote.detail}</p>}
        <div className="grid grid-cols-3 gap-4 text-center sm:grid-cols-4">
          <Tally label="Yes" value={s.yes} tone="text-pine" />
          <Tally label="No" value={s.no} tone="text-brick" />
          <Tally label="Abstain" value={s.abstain} tone="text-stone" />
          <Tally label="Not voted" value={s.waiting} tone="text-charcoal" className="hidden sm:block" />
        </div>
        <div className="mt-4">
          <Progress value={s.yes} max={s.needed} label="Yes votes toward passing" />
          <p className="mt-1.5 text-[0.92rem] text-stone">
            {s.yes} of {s.needed} yes votes needed{vote.amount ? ` · ${money(vote.amount)}` : ""}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Each home" sub={open ? "Got an answer by phone or in person? Record it here." : undefined} />
        <ul className="divide-y divide-line">
          {road.homes.map((h) => {
            const b = vote.ballots.find((x) => x.homeId === h.id);
            return (
              <li key={h.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{displayName(h)}</p>
                  <p className="text-[0.88rem] text-stone">{b ? `${b.via === "link" ? "From their link" : `Recorded: ${b.via}`} · ${fmtDateTime(b.at)}` : h.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  {b ? (
                    <Pill tone={b.choice === "yes" ? "paid" : b.choice === "no" ? "late" : "neutral"} icon={b.choice === "yes" ? <Check className="h-4 w-4" aria-hidden /> : b.choice === "no" ? <X className="h-4 w-4" aria-hidden /> : <CircleMinus className="h-4 w-4" aria-hidden />}>
                      {b.choice === "yes" ? "Yes" : b.choice === "no" ? "No" : "Abstain"}
                    </Pill>
                  ) : (
                    <Pill tone="neutral">Not voted</Pill>
                  )}
                  {open && <RecordVote onRecord={(c, via) => record(h.id, c, via)} />}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {sending && (
        <SendSheet
          open
          onClose={() => setSending(false)}
          kind="vote"
          heading="Send vote links"
          recipients={voteRecipients(road, vote)}
          logKind="vote"
          onLogged={(message) => dispatch({ type: "message.log", message })}
        />
      )}
    </>
  );
}

function Tally({ label, value, tone, className }: { label: string; value: number; tone: string; className?: string }) {
  return (
    <div className={className}>
      <p className={cx("tnum font-display text-[2rem] font-black leading-none", tone)}>{value}</p>
      <p className="mt-1 text-[0.9rem] font-semibold text-stone">{label}</p>
    </div>
  );
}

function RecordVote({ onRecord }: { onRecord: (c: Ballot["choice"], via: Ballot["via"]) => void }) {
  const [via, setVia] = useState<Ballot["via"]>("phone");
  return (
    <div className="flex items-center gap-1">
      <Select value={via} onChange={(e) => setVia(e.target.value as Ballot["via"])} className="min-h-10 w-[7.5rem] py-1 text-[0.88rem]" aria-label="How they told you">
        <option value="phone">By phone</option>
        <option value="in-person">In person</option>
        <option value="email">By email</option>
      </Select>
      <button onClick={() => onRecord("yes", via)} className="min-h-10 rounded-lg border-2 border-line px-2.5 text-[0.88rem] font-semibold hover:border-pine">
        Yes
      </button>
      <button onClick={() => onRecord("no", via)} className="min-h-10 rounded-lg border-2 border-line px-2.5 text-[0.88rem] font-semibold hover:border-brick">
        No
      </button>
    </div>
  );
}
