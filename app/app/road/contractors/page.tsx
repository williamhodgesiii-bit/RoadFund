"use client";

import { useState } from "react";
import { Mail, Phone, Plus } from "lucide-react";
import { PageHeader, RoadNav } from "@/components/app/common";
import { Button, Card, Dialog, Empty, Field, Input, Textarea } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import type { Contractor } from "@/lib/types";

export default function ContractorsPage() {
  const { road, now } = useRoad();
  const [editing, setEditing] = useState<Contractor | null>(null);
  const year = now.getFullYear();
  const paidThisYear = (id: string) =>
    road.expenses.filter((e) => e.contractorId === id && e.status === "paid" && e.paidAt && new Date(e.paidAt).getFullYear() === year).reduce((a, e) => a + e.amount, 0);

  return (
    <>
      <PageHeader
        title="Road"
        sub="The people who plow, grade and haul gravel for the road, and what the road paid each this year."
        actions={
          <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setEditing({ id: uid("ctr"), name: "", trade: "", phone: "", email: "", notes: "" })}>
            Add contractor
          </Button>
        }
      />
      <RoadNav />
      <Card>
        {road.contractors.length === 0 ? (
          <Empty title="No contractors yet">Add the companies that plow, grade and haul gravel for the road.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {road.contractors.map((c) => {
              const paid = paidThisYear(c.id);
              return (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{c.name}</p>
                    <p className="text-[0.92rem] text-stone">
                      {c.trade}
                      {paid > 0 && ` · paid ${money(paid)} in ${year}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[0.92rem]">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 font-semibold text-pine">
                          <Phone className="h-4 w-4" aria-hidden /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 font-semibold text-pine">
                          <Mail className="h-4 w-4" aria-hidden /> {c.email}
                        </a>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editing && <ContractorDialog value={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ContractorDialog({ value, onClose }: { value: Contractor; onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const [c, setC] = useState(value);
  const isNew = !road.contractors.some((x) => x.id === value.id);
  const set = (patch: Partial<Contractor>) => setC((x) => ({ ...x, ...patch }));
  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? "Add contractor" : c.name}
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="mr-auto text-brick hover:bg-brick-50" onClick={async () => (await dispatch({ type: "contractor.remove", contractorId: c.id }, "Removed.")) && onClose()}>
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={async () => (await dispatch({ type: "contractor.save", contractor: c }, "Saved.")) && onClose()} disabled={!c.name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="c-name">
            <Input id="c-name" value={c.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="What they do" htmlFor="c-trade">
            <Input id="c-trade" value={c.trade} onChange={(e) => set({ trade: e.target.value })} placeholder="Snow plowing" />
          </Field>
          <Field label="Phone" optional htmlFor="c-phone">
            <Input id="c-phone" type="tel" value={c.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Email" optional htmlFor="c-email">
            <Input id="c-email" type="email" value={c.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes" optional htmlFor="c-notes">
          <Textarea id="c-notes" rows={2} value={c.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
