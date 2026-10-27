"use client";

import { useState } from "react";
import { FileText, NotebookPen, Plus, ScrollText, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { AiBadge, FileThumb, PageHeader, PapersNav, PlanGate, UploadButton, useAiOn } from "@/components/app/common";
import { Button, Callout, Card, CardHeader, Dialog, Empty, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ai } from "@/lib/client/backend";
import { blobToBase64, fileUrl } from "@/lib/client/files";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate, isoDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import type { DocItem, DocKind } from "@/lib/types";

const KIND_LABEL: Record<DocKind, string> = {
  easement: "Deed or easement",
  plat: "Plat or map",
  agreement: "Agreement",
  insurance: "Insurance",
  minutes: "Meeting minutes",
  survey: "Survey",
  tax: "Tax filing",
  other: "Other",
};

interface DeedReading {
  documentType: string;
  recording: string;
  roadDescription: string;
  owners: string[];
  findings: { label: string; quote: string }[];
  gaps: string[];
}

export default function DocumentsPage() {
  const { road, entry, dispatch } = useRoad();
  const toast = useToast();
  const aiOn = useAiOn();
  const [adding, setAdding] = useState(false);
  const [minutes, setMinutes] = useState(false);
  const [reading, setReading] = useState<{ doc: DocItem; result: DeedReading | null; busy: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const kinds = (Object.keys(KIND_LABEL) as DocKind[]).filter((k) => road.docs.some((d) => d.kind === k));
  const hasInsurance = road.docs.some((d) => d.kind === "insurance");

  const readDeed = async (doc: DocItem) => {
    if (!doc.fileId) return;
    setReading({ doc, result: null, busy: true });
    try {
      const url = await fileUrl(entry.where, doc.fileId);
      const blob = url ? await fetch(url).then((r) => r.blob()) : null;
      if (!blob) throw new Error("The file isn't on this device.");
      const res = await ai<DeedReading>({ task: "deed", mime: blob.type || doc.mime || "application/pdf", data: await blobToBase64(blob) });
      if (!res.ok || !res.data) throw new Error(res.error);
      setReading({ doc, result: res.data, busy: false });
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Couldn't read it.", "error");
      setReading(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Votes & Papers"
        sub="Deeds, plat, agreement, insurance and minutes in one place, so the next captain has everything."
        actions={
          <>
            {aiOn && (
              <Button variant="secondary" icon={<NotebookPen className="h-5 w-5" aria-hidden />} onClick={() => setMinutes(true)}>
                Write minutes
              </Button>
            )}
            <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setAdding(true)}>
              Add document
            </Button>
          </>
        }
      />
      <PapersNav />
      <PlanGate needs="roadfund" feature="Documents" pitch="Keep the deed easements, plat, agreement, insurance and meeting minutes with the road, not in one person's kitchen drawer.">
        {!hasInsurance && (
          <Callout
            tone="warn"
            className="mb-6"
            title="No liability insurance on file"
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
                onClick={() => {
                  dispatch({ type: "message.log", message: { id: uid("msg"), at: new Date().toISOString(), kind: "general", channel: "email", homeIds: [], body: "Requested a group road liability quote from the partner insurer." } });
                  toast("Quote request sent to the partner insurer (test mode).");
                }}
              >
                Get a group liability quote
              </Button>
            }
          >
            Owners can be sued if someone is hurt by a known hazard on the road, and homeowner policies may not cover road-group roles.
          </Callout>
        )}
        {road.docs.length === 0 ? (
          <Card>
            <Empty icon={<FileText className="h-6 w-6" aria-hidden />} title="No documents yet" action={<Button onClick={() => setAdding(true)}>Add the deed or plat</Button>}>
              Start with the deed easement and the plat. They describe the road and who has the right to use it.
            </Empty>
          </Card>
        ) : (
          <div className="space-y-6">
            {kinds.map((k) => (
              <Card key={k}>
                <CardHeader title={KIND_LABEL[k]} />
                <ul className="divide-y divide-line">
                  {road.docs
                    .filter((d) => d.kind === k)
                    .map((d) => (
                      <li key={d.id} className="px-5 py-3.5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          {d.fileId ? <FileThumb fileId={d.fileId} alt={d.title} className="h-14 w-14 shrink-0 rounded-lg" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-paper-2 text-stone"><ScrollText className="h-6 w-6" aria-hidden /></div>}
                          <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>
                            <p className="font-semibold">{d.title}</p>
                            <p className="text-[0.9rem] text-stone">
                              Added {fmtDate(d.addedAt)}
                              {d.fileName ? ` · ${d.fileName}` : " · no file attached"}
                            </p>
                          </button>
                          <div className="flex gap-2">
                            {aiOn && d.fileId && (d.kind === "easement" || d.kind === "plat" || d.kind === "survey" || d.kind === "agreement") && (
                              <Button size="sm" variant="secondary" icon={<Sparkles className="h-4 w-4" aria-hidden />} onClick={() => readDeed(d)}>
                                Read it <AiBadge />
                              </Button>
                            )}
                            <button className="rounded-lg p-2 text-stone hover:bg-brick-50 hover:text-brick" aria-label={`Remove ${d.title}`} onClick={() => window.confirm(`Remove "${d.title}"?`) && dispatch({ type: "doc.remove", docId: d.id }, "Removed.")}>
                              <Trash2 className="h-5 w-5" aria-hidden />
                            </button>
                          </div>
                        </div>
                        {open === d.id && d.note && <p className="mt-3 whitespace-pre-line rounded-xl bg-paper p-3 text-[0.95rem]">{d.note}</p>}
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </PlanGate>
      {adding && <AddDocDialog onClose={() => setAdding(false)} />}
      {minutes && <MinutesDialog onClose={() => setMinutes(false)} />}
      {reading && <DeedDialog state={reading} onClose={() => setReading(null)} />}
    </>
  );
}

function AddDocDialog({ onClose }: { onClose: () => void }) {
  const { dispatch } = useRoad();
  const [kind, setKind] = useState<DocKind>("easement");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<{ id: string; name: string; type: string; size: number } | null>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a document"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={async () => {
              const doc: DocItem = { id: uid("doc"), kind, title: title.trim(), fileId: file?.id ?? null, fileName: file?.name ?? null, mime: file?.type ?? null, size: file?.size ?? null, addedAt: new Date().toISOString(), note };
              if (await dispatch({ type: "doc.add", doc }, "Document added.")) onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type" htmlFor="doc-kind">
          <Select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
            {(Object.keys(KIND_LABEL) as DocKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="doc-title">
          <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Access easement, Liber 412 Page 88" />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <UploadButton
            label={file ? "Replace file" : "Attach photo or PDF"}
            accept="image/*,application/pdf"
            onUploaded={(id, f) => {
              setFile({ id, ...f });
              if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, ""));
            }}
          />
          {file && <span className="text-[0.92rem] text-stone">{file.name}</span>}
        </div>
        <Field label="Notes" optional htmlFor="doc-note">
          <Textarea id="doc-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function MinutesDialog({ onClose }: { onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const toast = useToast();
  const [date, setDate] = useState(isoDate());
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const write = async () => {
    setBusy(true);
    const res = await ai<{ text: string }>({ task: "minutes", roadName: road.name, date, notes });
    setBusy(false);
    if (res.ok && res.data) setDraft(res.data.text);
    else toast(res.error ?? "Couldn't write minutes.", "error");
  };
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title="Meeting minutes"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {draft ? (
            <Button
              onClick={async () => {
                const doc: DocItem = { id: uid("doc"), kind: "minutes", title: `Road meeting minutes, ${fmtDate(date)}`, fileId: null, fileName: null, mime: null, size: null, addedAt: new Date().toISOString(), note: draft };
                if (await dispatch({ type: "doc.add", doc }, "Minutes saved. Share them so neighbors can correct anything.")) onClose();
              }}
            >
              Save minutes
            </Button>
          ) : (
            <Button loading={busy} disabled={!notes.trim()} icon={<Sparkles className="h-5 w-5" aria-hidden />} onClick={write}>
              Write the minutes
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Meeting date" htmlFor="min-date">
          <Input id="min-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
        </Field>
        {!draft ? (
          <Field label="Your rough notes" hint="Who came, what was decided, vote counts, money, next steps. Shorthand is fine." htmlFor="min-notes">
            <Textarea id="min-notes" rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="8 of 9 there (Pike absent). Budget 3080 approved 7-1. Kowalski again for plow. Culvert: get 3 bids…" />
          </Field>
        ) : (
          <Field label="Draft minutes" hint="Edit anything. Items marked [check] need a second look." htmlFor="min-draft">
            <Textarea id="min-draft" rows={14} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

function DeedDialog({ state, onClose }: { state: { doc: DocItem; result: DeedReading | null; busy: boolean }; onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const r = state.result;
  const locked = ["notary", "recording", "recorded"].includes(road.agreement.step);
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={state.doc.title}
      footer={
        r && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={() => dispatch({ type: "doc.add", doc: { ...state.doc, note: formatReading(r) } }, "Findings saved to the document.")}
            >
              Save findings to notes
            </Button>
            {r.roadDescription && !locked && (
              <Button onClick={async () => (await dispatch({ type: "agreement.terms", terms: { ...road.agreement.terms, roadDescription: r.roadDescription } }, "Road description added to the agreement draft.")) && onClose()}>
                Use description in agreement
              </Button>
            )}
          </>
        )
      }
    >
      {state.busy || !r ? (
        <p className="flex items-center gap-2 text-lake">
          <Sparkles className="h-5 w-5 animate-pulse" aria-hidden /> Reading the document…
        </p>
      ) : (
        <div className="space-y-4">
          <p>
            <strong>{r.documentType}</strong>
            {r.recording && ` · ${r.recording}`}
          </p>
          {r.roadDescription && (
            <div>
              <p className="font-semibold">Road description</p>
              <p className="rounded-xl bg-paper p-3">{r.roadDescription}</p>
            </div>
          )}
          {r.owners.length > 0 && <p className="text-stone">Names found: {r.owners.join(", ")}</p>}
          <div>
            <p className="font-semibold">What it says, with the source text</p>
            <ul className="mt-2 space-y-2">
              {r.findings.map((f, i) => (
                <li key={i} className="rounded-xl border border-line p-3">
                  <p className="font-semibold">{f.label}</p>
                  <blockquote className="mt-1 border-l-4 border-sign pl-3 text-[0.95rem] italic">{f.quote}</blockquote>
                </li>
              ))}
            </ul>
          </div>
          {r.gaps.length > 0 && (
            <Callout tone="warn" title="Raise these with the attorney">
              <ul className="list-disc pl-5">
                {r.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </Callout>
          )}
          <p className="text-[0.88rem] text-stone">Read by AI. An attorney confirms anything legal before the agreement is drafted from it.</p>
        </div>
      )}
    </Dialog>
  );
}

function formatReading(r: DeedReading): string {
  return [
    `${r.documentType}${r.recording ? ` (${r.recording})` : ""}`,
    r.roadDescription && `Road: ${r.roadDescription}`,
    ...r.findings.map((f) => `${f.label}: "${f.quote}"`),
    r.gaps.length ? `To check: ${r.gaps.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
