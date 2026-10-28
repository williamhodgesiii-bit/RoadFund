"use client";

import { useState } from "react";
import { FileText, Plus, ScrollText, Trash2 } from "lucide-react";
import { FileThumb, PageHeader, PapersNav, PlanGate, UploadButton } from "@/components/app/common";
import { Button, Callout, Card, CardHeader, Dialog, Empty, Field, Input, Select, Textarea } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate } from "@/lib/dates";
import { uid } from "@/lib/ids";
import type { DocItem, DocKind } from "@/lib/types";

const KIND_LABEL: Record<DocKind, string> = {
  easement: "Deed or easement",
  plat: "Road map (plat)",
  agreement: "Agreement",
  insurance: "Insurance",
  minutes: "Meeting minutes",
  survey: "Survey",
  tax: "Tax papers",
  other: "Other",
};

export default function DocumentsPage() {
  const { road, dispatch } = useRoad();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const kinds = (Object.keys(KIND_LABEL) as DocKind[]).filter((k) => road.docs.some((d) => d.kind === k));
  const hasInsurance = road.docs.some((d) => d.kind === "insurance");

  return (
    <>
      <PageHeader
        title="Votes & Papers"
        sub="The deed, the road map, the agreement, insurance and meeting notes, kept with the road so the next captain has them."
        actions={
          <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setAdding(true)}>
            Add document
          </Button>
        }
      />
      <PapersNav />
      <PlanGate needs="roadfund" feature="Documents" pitch="Keep the deed easements, plat, agreement, insurance and meeting minutes with the road, not in one person's kitchen drawer.">
        {!hasInsurance && (
          <Callout tone="warn" className="mb-6" title="No liability insurance on file">
            Owners can be sued if someone is hurt by a known hazard on the road, and homeowner policies may not cover road-group roles. Ask an insurance agent about a
            general liability policy for the road group, then add it here as an Insurance document. Road Status Letters show whether a policy is on file.
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
