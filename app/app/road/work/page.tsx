"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CircleAlert, Hammer, Plus, Trash2 } from "lucide-react";
import { FileThumb, PageHeader, PlanGate, RoadNav, UploadButton } from "@/components/app/common";
import { Button, Callout, Card, Choice, cx, Dialog, Empty, Field, Input, Pill, Select, Textarea } from "@/components/ui";
import { AmountInput } from "@/components/amount-input";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, isoDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import type { PhotoRef, WorkEntry } from "@/lib/types";

type Filter = "all" | "work" | "damage";

export default function WorkPage() {
  const { road, dispatch } = useRoad();
  const [filter, setFilter] = useState<Filter>("all");
  const startNew = useSearchParams().get("new");
  const [editing, setEditing] = useState<WorkEntry | null>(() => (startNew === "work" || startNew === "damage" ? blank(startNew) : null));

  const entries = road.work.filter((w) => filter === "all" || w.kind === filter);
  const openProblems = road.work.filter((w) => w.kind === "damage" && w.status !== "fixed");

  return (
    <>
      <PageHeader
        title="Road"
        sub="What was done, when and by whom, with photos. Neighbors can see where their money went."
        actions={
          <>
            <Button variant="secondary" icon={<CircleAlert className="h-5 w-5" aria-hidden />} onClick={() => setEditing(blank("damage"))}>
              Note a problem
            </Button>
            <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setEditing(blank("work"))}>
              Log work
            </Button>
          </>
        }
      />
      <RoadNav />
      <PlanGate needs="roadfund" feature="The work log" pitch="Before-and-after photos and a record of every repair, so neighbors can see where their money went.">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "work", "damage"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cx("min-h-11 rounded-full border-2 px-4 font-semibold", filter === f ? "border-pine bg-pine text-white" : "border-line bg-white")}>
              {f === "all" ? "Everything" : f === "work" ? "Work done" : `Problems (${openProblems.length} to fix)`}
            </button>
          ))}
        </div>
        {entries.length === 0 ? (
          <Card>
            <Empty icon={<Hammer className="h-6 w-6" aria-hidden />} title="Nothing written down yet" action={<Button onClick={() => setEditing(blank("work"))}>Log work</Button>}>
              Add the last grading or plow visit with a photo or two.
            </Empty>
          </Card>
        ) : (
          <ul className="space-y-4">
            {entries.map((w) => {
              const c = road.contractors.find((x) => x.id === w.contractorId);
              return (
                <li key={w.id} id={w.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[1.1rem] font-bold">
                          {w.title}
                          {w.kind === "damage" && (
                            <Pill tone={w.status === "fixed" ? "paid" : "warn"}>{w.status === "fixed" ? "Fixed" : w.status === "scheduled" ? "Repair scheduled" : "Needs fixing"}</Pill>
                          )}
                        </p>
                        <p className="text-[0.92rem] text-stone">
                          {fmtDate(w.date)}
                          {c && ` · ${c.name}`}
                          {w.cost !== null && ` · ${money(w.cost)}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {w.kind === "damage" && w.status !== "fixed" && (
                          <Select
                            value={w.status ?? "open"}
                            onChange={(e) => dispatch({ type: "work.save", entry: { ...w, status: e.target.value as WorkEntry["status"] } }, "Updated.")}
                            className="min-h-11 w-44 py-1 text-[0.95rem]"
                            aria-label="Repair status"
                          >
                            <option value="open">Needs fixing</option>
                            <option value="scheduled">Repair scheduled</option>
                            <option value="fixed">Fixed</option>
                          </Select>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setEditing(w)}>
                          Edit
                        </Button>
                      </div>
                    </div>
                    {w.description && <p className="mt-2">{w.description}</p>}
                    {w.photos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {w.photos.map((p) => (
                          <figure key={p.fileId}>
                            <FileThumb fileId={p.fileId} alt={`${w.title} (${p.tag})`} className="h-28 w-36 rounded-lg" />
                            <figcaption className="mt-0.5 text-[0.85rem] capitalize text-stone">{p.tag}</figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </PlanGate>
      {editing && <WorkDialog entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function blank(kind: "work" | "damage"): WorkEntry {
  return {
    id: uid("wrk"),
    kind,
    date: isoDate(),
    title: "",
    description: "",
    contractorId: null,
    cost: null,
    photos: [],
    status: kind === "damage" ? "open" : null,
    createdAt: new Date().toISOString(),
  };
}

function WorkDialog({ entry, onClose }: { entry: WorkEntry; onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const [w, setW] = useState<WorkEntry>(entry);
  const isNew = !road.work.some((x) => x.id === entry.id);
  const set = (patch: Partial<WorkEntry>) => setW((x) => ({ ...x, ...patch }));
  const addPhoto = (fileId: string) => set({ photos: [...w.photos, { fileId, tag: w.kind === "damage" ? "damage" : w.photos.length === 0 ? "before" : "after" } as PhotoRef] });

  const save = async () => {
    if (await dispatch({ type: "work.save", entry: w }, isNew ? (w.kind === "damage" ? "Problem noted." : "Work logged.") : "Saved.")) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={isNew ? (w.kind === "damage" ? "Note a problem" : "Log work") : "Edit"}
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="mr-auto text-brick hover:bg-brick-50" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={async () => (await dispatch({ type: "work.remove", entryId: w.id }, "Removed.")) && onClose()}>
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!w.title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Choice
          name="wk-kind"
          columns={2}
          value={w.kind}
          onChange={(k) => set({ kind: k, status: k === "damage" ? w.status ?? "open" : null })}
          options={[
            { value: "work", label: "Work done" },
            { value: "damage", label: "Problem to fix" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What" htmlFor="wk-title">
            <Input id="wk-title" value={w.title} onChange={(e) => set({ title: e.target.value })} placeholder={w.kind === "damage" ? "Potholes near Lot 7" : "Spring grading"} />
          </Field>
          <Field label="Date" htmlFor="wk-date">
            <Input id="wk-date" type="date" value={w.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          {w.kind === "work" ? (
            <>
              <Field label="Who did it" optional htmlFor="wk-ctr">
                <Select id="wk-ctr" value={w.contractorId ?? ""} onChange={(e) => set({ contractorId: e.target.value || null })}>
                  <option value="">Neighbors</option>
                  {road.contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cost" optional htmlFor="wk-cost">
                <AmountInput id="wk-cost" value={w.cost ?? 0} onChange={(c) => set({ cost: c || null })} />
              </Field>
            </>
          ) : (
            <Field label="Where it stands" htmlFor="wk-status">
              <Select id="wk-status" value={w.status ?? "open"} onChange={(e) => set({ status: e.target.value as WorkEntry["status"] })}>
                <option value="open">Needs fixing</option>
                <option value="scheduled">Repair scheduled</option>
                <option value="fixed">Fixed</option>
              </Select>
            </Field>
          )}
        </div>
        <Field label="Notes" optional htmlFor="wk-desc">
          <Textarea id="wk-desc" rows={3} value={w.description} onChange={(e) => set({ description: e.target.value })} placeholder={w.kind === "damage" ? "Where on the road and how big" : ""} />
        </Field>
        <div>
          <UploadButton label="Add photos" multiple capture onUploaded={addPhoto} />
          {w.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {w.photos.map((p, i) => (
                <div key={p.fileId} className="space-y-1">
                  <FileThumb fileId={p.fileId} alt="Photo" className="h-24 w-28 rounded-lg" />
                  <div className="flex items-center gap-2">
                    <select
                      value={p.tag}
                      onChange={(e) => set({ photos: w.photos.map((x, j) => (j === i ? { ...x, tag: e.target.value as PhotoRef["tag"] } : x)) })}
                      className="min-h-9 rounded border border-line px-1 text-[0.85rem]"
                      aria-label="Photo label"
                    >
                      <option value="before">Before</option>
                      <option value="after">After</option>
                      <option value="damage">Problem</option>
                      <option value="receipt">Receipt</option>
                      <option value="other">Other</option>
                    </select>
                    <button className="min-h-9 text-[0.85rem] font-semibold text-brick" onClick={() => set({ photos: w.photos.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {w.kind === "work" && w.cost && isNew && <Callout tone="info">To pay for this, add the bill under Money, then Bills.</Callout>}
      </div>
    </Dialog>
  );
}
