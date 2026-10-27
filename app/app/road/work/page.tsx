"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CircleAlert, Hammer, Plus, Sparkles, Trash2 } from "lucide-react";
import { AiBadge, FileThumb, PageHeader, PlanGate, RoadNav, UploadButton, useAiOn } from "@/components/app/common";
import { Button, Callout, Card, Choice, cx, Dialog, Empty, Field, Input, Pill, Select, Textarea } from "@/components/ui";
import { AmountInput } from "@/components/amount-input";
import { useToast } from "@/components/toast";
import { ai } from "@/lib/client/backend";
import { blobToBase64, fileUrl } from "@/lib/client/files";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, isoDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import type { LatLng, PhotoRef, WorkEntry } from "@/lib/types";

const RoadMap = dynamic(() => import("@/components/road-map").then((m) => m.RoadMap), { ssr: false, loading: () => <div className="h-[300px] rounded-xl bg-paper-2" /> });

type Filter = "all" | "work" | "damage";

export default function WorkPage() {
  const { road, dispatch } = useRoad();
  const [filter, setFilter] = useState<Filter>("all");
  const startNew = useSearchParams().get("new");
  const [editing, setEditing] = useState<WorkEntry | null>(() => (startNew === "work" || startNew === "damage" ? blank(startNew) : null));

  const entries = road.work.filter((w) => filter === "all" || w.kind === filter);
  const openDamage = road.work.filter((w) => w.kind === "damage" && w.status !== "fixed");

  return (
    <>
      <PageHeader
        title="Road"
        sub="What was done, when, by whom, with photos. Builds the case for next year's budget."
        actions={
          <>
            <Button variant="secondary" icon={<CircleAlert className="h-5 w-5" aria-hidden />} onClick={() => setEditing(blank("damage"))}>
              Report damage
            </Button>
            <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setEditing(blank("work"))}>
              Log work
            </Button>
          </>
        }
      />
      <RoadNav />
      <PlanGate needs="roadfund" feature="The work log" pitch="Before-and-after photos, damage pinned on the map, and a record of every repair that shows neighbors where their money went.">
        {openDamage.some((w) => w.position) && road.path.length > 1 && (
          <Card className="mb-6 p-4">
            <p className="mb-3 font-bold">Open damage on the map</p>
            <RoadMap
              center={road.center}
              path={road.path}
              height={300}
              pins={openDamage.filter((w) => w.position).map((w) => ({ id: w.id, position: w.position!, label: "!", title: w.title, tone: "damage" as const }))}
              onPinClick={(id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
          </Card>
        )}
        <div className="mb-4 flex gap-2">
          {(["all", "work", "damage"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cx("rounded-full border-2 px-4 py-1.5 font-semibold", filter === f ? "border-pine bg-pine text-white" : "border-line bg-white")}>
              {f === "all" ? "Everything" : f === "work" ? "Work done" : `Damage (${openDamage.length} open)`}
            </button>
          ))}
        </div>
        {entries.length === 0 ? (
          <Card>
            <Empty icon={<Hammer className="h-6 w-6" aria-hidden />} title="Nothing logged yet" action={<Button onClick={() => setEditing(blank("work"))}>Log work</Button>}>
              Add the last grading or plow visit with a couple of photos.
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
                            <Pill tone={w.status === "fixed" ? "paid" : w.severity === "severe" ? "late" : "warn"}>
                              {w.status === "fixed" ? "Fixed" : w.status === "scheduled" ? "Repair scheduled" : `${w.severity ?? "Open"} damage`}
                            </Pill>
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
                            className="min-h-10 w-40 py-1 text-[0.9rem]"
                            aria-label="Repair status"
                          >
                            <option value="open">Open</option>
                            <option value="scheduled">Scheduled</option>
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
                            <figcaption className="mt-0.5 text-[0.8rem] capitalize text-stone">{p.tag}</figcaption>
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
    position: null,
    severity: kind === "damage" ? "moderate" : null,
    status: kind === "damage" ? "open" : null,
    createdAt: new Date().toISOString(),
  };
}

function WorkDialog({ entry, onClose }: { entry: WorkEntry; onClose: () => void }) {
  const { road, entry: roadEntry, dispatch } = useRoad();
  const toast = useToast();
  const aiOn = useAiOn();
  const [w, setW] = useState<WorkEntry>(entry);
  const [reading, setReading] = useState(false);
  const isNew = !road.work.some((x) => x.id === entry.id);
  const set = (patch: Partial<WorkEntry>) => setW((x) => ({ ...x, ...patch }));
  const addPhoto = (fileId: string) => set({ photos: [...w.photos, { fileId, tag: w.kind === "damage" ? "damage" : w.photos.length === 0 ? "before" : "after" } as PhotoRef] });

  const describe = async () => {
    const first = w.photos[0];
    if (!first) return;
    setReading(true);
    try {
      const url = await fileUrl(roadEntry.where, first.fileId);
      const blob = url ? await fetch(url).then((r) => r.blob()) : null;
      if (!blob) throw new Error("Couldn't open the photo.");
      const res = await ai<{ title: string; severity: "minor" | "moderate" | "severe"; sizeEstimate: string; description: string }>({ task: "damage", mime: blob.type || "image/jpeg", data: await blobToBase64(blob), note: w.description });
      if (!res.ok || !res.data) throw new Error(res.error);
      set({ title: w.title || res.data.title, severity: res.data.severity, description: `${res.data.description} Size: ${res.data.sizeEstimate} (estimate).` });
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Couldn't read the photo.", "error");
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    if (await dispatch({ type: "work.save", entry: w }, isNew ? (w.kind === "damage" ? "Damage reported." : "Work logged.") : "Saved.")) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={isNew ? (w.kind === "damage" ? "Report damage" : "Log work") : "Edit entry"}
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
          onChange={(k) => set({ kind: k, severity: k === "damage" ? w.severity ?? "moderate" : null, status: k === "damage" ? w.status ?? "open" : null })}
          options={[
            { value: "work", label: "Work done" },
            { value: "damage", label: "Damage to fix" },
          ]}
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <UploadButton label="Add photos" multiple capture onUploaded={addPhoto} />
            {aiOn && w.kind === "damage" && w.photos.length > 0 && (
              <Button size="sm" variant="secondary" loading={reading} icon={<Sparkles className="h-4 w-4" aria-hidden />} onClick={describe}>
                Describe from photo <AiBadge />
              </Button>
            )}
          </div>
          {w.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {w.photos.map((p, i) => (
                <div key={p.fileId} className="space-y-1">
                  <FileThumb fileId={p.fileId} alt="Photo" className="h-24 w-28 rounded-lg" />
                  <div className="flex items-center gap-1">
                    <select
                      value={p.tag}
                      onChange={(e) => set({ photos: w.photos.map((x, j) => (j === i ? { ...x, tag: e.target.value as PhotoRef["tag"] } : x)) })}
                      className="rounded border border-line px-1 py-0.5 text-[0.8rem]"
                      aria-label="Photo label"
                    >
                      {["before", "after", "damage", "receipt", "other"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <button className="text-[0.8rem] text-brick" onClick={() => set({ photos: w.photos.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="wk-title">
            <Input id="wk-title" value={w.title} onChange={(e) => set({ title: e.target.value })} placeholder={w.kind === "damage" ? "Pothole near Lot 7" : "Spring grading"} />
          </Field>
          <Field label="Date" htmlFor="wk-date">
            <Input id="wk-date" type="date" value={w.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          {w.kind === "work" ? (
            <>
              <Field label="Contractor" optional htmlFor="wk-ctr">
                <Select id="wk-ctr" value={w.contractorId ?? ""} onChange={(e) => set({ contractorId: e.target.value || null })}>
                  <option value="">Neighbors / none</option>
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
            <>
              <Field label="How bad" htmlFor="wk-sev">
                <Select id="wk-sev" value={w.severity ?? "moderate"} onChange={(e) => set({ severity: e.target.value as WorkEntry["severity"] })}>
                  <option value="minor">Minor: can wait</option>
                  <option value="moderate">Moderate: fix this season</option>
                  <option value="severe">Severe: fix now</option>
                </Select>
              </Field>
              <Field label="Status" htmlFor="wk-status">
                <Select id="wk-status" value={w.status ?? "open"} onChange={(e) => set({ status: e.target.value as WorkEntry["status"] })}>
                  <option value="open">Open</option>
                  <option value="scheduled">Repair scheduled</option>
                  <option value="fixed">Fixed</option>
                </Select>
              </Field>
            </>
          )}
        </div>
        <Field label="Notes" optional htmlFor="wk-desc">
          <Textarea id="wk-desc" rows={3} value={w.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        {road.path.length > 1 && (
          <div>
            <p className="mb-1.5 font-semibold">Where on the road {w.position ? "(tap to move)" : "(tap the map)"}</p>
            <RoadMap
              center={road.center}
              path={road.path}
              height={240}
              mode="place"
              onPlace={(p: LatLng) => set({ position: p })}
              pins={w.position ? [{ id: w.id, position: w.position, label: w.kind === "damage" ? "!" : "✓", title: w.title || "Here", tone: w.kind === "damage" ? "damage" : "fixed" }] : []}
            />
          </div>
        )}
        {w.kind === "work" && w.cost && isNew && <Callout tone="info">To pay for this, add the contractor&apos;s bill under Money → Bills.</Callout>}
      </div>
    </Dialog>
  );
}
