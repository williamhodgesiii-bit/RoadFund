"use client";

import { useState } from "react";
import { Check, Copy, Crown, ExternalLink, Mail, MessageSquare, Pencil, Phone, Plus, Send, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app/common";
import { SendSheet } from "@/components/app/send-sheet";
import { Button, Callout, Card, Checkbox, Dialog, Field, Input, Pill, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { neighborLink } from "@/lib/client/backend";
import { copyText } from "@/lib/client/links";
import { introRecipients } from "@/lib/client/recipients";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate } from "@/lib/dates";
import { newHome } from "@/lib/factory";
import { displayName } from "@/lib/selectors";
import type { Home } from "@/lib/types";

export default function NeighborsPage() {
  const { road, entry, dispatch } = useRoad();
  const toast = useToast();
  const [editing, setEditing] = useState<Home | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [inviting, setInviting] = useState(false);
  const version = road.agreement.version;
  const signedIds = new Set(road.agreement.signatures.filter((s) => s.version === version).map((s) => s.homeId));
  const optedIn = road.homes.filter((h) => h.smsOptIn).length;

  return (
    <>
      <PageHeader
        title="Neighbors"
        sub={`${road.homes.length} lots · ${optedIn} agreed to texts · only you see contact details`}
        actions={
          <>
            <Button variant="secondary" icon={<Send className="h-5 w-5" aria-hidden />} onClick={() => setInviting(true)}>
              Send everyone their link
            </Button>
            <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setEditing(newHome({ label: `Lot ${road.homes.length + 1}` }))}>
              Add a lot
            </Button>
          </>
        }
      />
      {entry.where === "local" && (
        <Callout tone="info" className="mb-5" title="Links open on this device only">
          This road is saved in this browser, so neighbor links work here for testing. Add cloud storage (Upstash Redis on Vercel) to share links with real phones.
        </Callout>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {road.homes.map((h) => {
          const link = neighborLink(road, h.token);
          return (
            <li key={h.id}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[1.1rem] font-bold">
                      {displayName(h)}
                      {h.id === road.captainHomeId && (
                        <Pill tone="paid" icon={<Crown className="h-4 w-4" aria-hidden />}>
                          Captain
                        </Pill>
                      )}
                    </p>
                    <p className="text-stone">
                      {h.label}
                      {h.address && ` · ${h.address}`}
                      {h.vacant && " · vacant"}
                    </p>
                  </div>
                  <button className="rounded-lg p-2 text-stone hover:bg-paper-2" onClick={() => setEditing(h)} aria-label={`Edit ${displayName(h)}`}>
                    <Pencil className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <dl className="mt-3 space-y-1.5 text-[0.95rem]">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-stone" aria-hidden />
                    <dt className="sr-only">Phone</dt>
                    <dd>{h.phone || <span className="text-stone">No phone</span>}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-stone" aria-hidden />
                    <dt className="sr-only">Email</dt>
                    <dd className="truncate">{h.email || <span className="text-stone">No email</span>}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-stone" aria-hidden />
                    <dt className="sr-only">Texts</dt>
                    <dd>{h.smsOptIn ? `Agreed to texts${h.smsOptInAt ? ` ${fmtDate(h.smsOptInAt)}` : ""}` : <span className="text-stone">Hasn&apos;t agreed to texts yet</span>}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${signedIds.has(h.id) ? "text-pine" : "text-stone"}`} aria-hidden />
                    <dt className="sr-only">Agreement</dt>
                    <dd>{signedIds.has(h.id) ? "Signed the agreement" : <span className="text-stone">Not signed</span>}</dd>
                  </div>
                </dl>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" aria-hidden />} onClick={async () => (await copyText(link)) && toast(`Copied ${displayName(h)}'s link.`)}>
                    Copy link
                  </Button>
                  <a href={`/n/${road.id}/${h.token}`} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[0.9rem] font-semibold text-pine hover:bg-pine-50">
                    <ExternalLink className="h-4 w-4" aria-hidden /> Open their page
                  </a>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card className="mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Handing off the captain role?</p>
          <p className="text-stone">The ledger, documents and history stay with the road.</p>
        </div>
        <Button variant="secondary" icon={<UserPlus className="h-5 w-5" aria-hidden />} onClick={() => setHandoff(true)}>
          Hand off
        </Button>
      </Card>

      {editing && <HomeDialog home={editing} onClose={() => setEditing(null)} />}
      {handoff && <HandoffDialog onClose={() => setHandoff(false)} />}
      {inviting && (
        <SendSheet open onClose={() => setInviting(false)} kind="intro" heading="Send everyone their page" recipients={introRecipients(road)} logKind="general" onLogged={(message) => dispatch({ type: "message.log", message })} />
      )}
    </>
  );
}

function HomeDialog({ home, onClose }: { home: Home; onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const [h, setH] = useState(home);
  const isNew = !road.homes.some((x) => x.id === home.id);
  const set = (patch: Partial<Home>) => setH((x) => ({ ...x, ...patch }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v) >= 0 ? Number(v) : null);
  const save = async () => {
    const ok = isNew
      ? await dispatch({ type: "home.add", home: h }, "Lot added.")
      : await dispatch(
          {
            type: "home.update",
            homeId: h.id,
            patch: { label: h.label, address: h.address, owners: h.owners, phone: h.phone, email: h.email, distanceFt: h.distanceFt, frontageFt: h.frontageFt, vacant: h.vacant, notes: h.notes, emailOptIn: !!h.email && h.emailOptIn },
          },
          "Saved.",
        );
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? "Add a lot" : displayName(home)}
      footer={
        <>
          {!isNew && home.id !== road.captainHomeId && (
            <Button variant="ghost" className="mr-auto text-brick hover:bg-brick-50" onClick={async () => window.confirm(`Remove ${displayName(home)} from the road?`) && (await dispatch({ type: "home.remove", homeId: home.id }, "Removed.")) && onClose()}>
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!h.label.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lot name or number" htmlFor="nh-label">
            <Input id="nh-label" value={h.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Address" optional htmlFor="nh-addr">
            <Input id="nh-addr" value={h.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Owner name(s)" optional htmlFor="nh-own">
            <Input id="nh-own" value={h.owners} onChange={(e) => set({ owners: e.target.value })} />
          </Field>
          <Field label="Mobile phone" optional htmlFor="nh-ph">
            <Input id="nh-ph" type="tel" value={h.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Email" optional htmlFor="nh-em">
            <Input id="nh-em" type="email" value={h.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Driveway distance from entrance" optional htmlFor="nh-d">
            <Input id="nh-d" inputMode="numeric" suffix="ft" value={h.distanceFt ?? ""} onChange={(e) => set({ distanceFt: num(e.target.value) })} />
          </Field>
          <Field label="Frontage" optional htmlFor="nh-f">
            <Input id="nh-f" inputMode="numeric" suffix="ft" value={h.frontageFt ?? ""} onChange={(e) => set({ frontageFt: num(e.target.value) })} />
          </Field>
        </div>
        <Checkbox checked={h.vacant} onChange={(v) => set({ vacant: v })} label="Vacant lot" />
        <Field label="Notes" optional hint="Only you see these." htmlFor="nh-notes">
          <Textarea id="nh-notes" rows={2} value={h.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <p className="text-[0.9rem] text-stone">
          Text consent comes from the neighbor on their own page, so it can&apos;t be switched on here.{" "}
          {!isNew && home.smsOptIn && (
            <button className="font-semibold text-brick underline" onClick={() => dispatch({ type: "home.update", homeId: home.id, patch: { smsOptIn: false } }, "Texts turned off for this neighbor.")}>
              Stop texts to this neighbor
            </button>
          )}
        </p>
      </div>
    </Dialog>
  );
}

function HandoffDialog({ onClose }: { onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const others = road.homes.filter((h) => h.id !== road.captainHomeId);
  const [to, setTo] = useState(others[0]?.id ?? "");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Hand off the captain role"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!to} onClick={async () => (await dispatch({ type: "captain.handoff", homeId: to }, "Captain role handed off.")) && onClose()}>
            Hand off
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New captain" htmlFor="ho-to">
          <Select id="ho-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {others.map((h) => (
              <option key={h.id} value={h.id}>
                {displayName(h)} ({h.label})
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-stone">
          Messages, bills and letters will go out under their name.{" "}
          {road.homes.find((h) => h.id === to)?.email
            ? "They can open the road on their own phone by signing in with their email at Road Fund's Captain sign-in page, or you can send them the captain link from Settings."
            : "Add their email first so they can sign in on their own phone, or send them the captain link from Settings."}
        </p>
      </div>
    </Dialog>
  );
}
