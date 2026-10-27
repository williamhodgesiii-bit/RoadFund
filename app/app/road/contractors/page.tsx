"use client";

import { useState } from "react";
import { CloudSnow, Mail, Phone, Plus } from "lucide-react";
import { PageHeader, RoadNav } from "@/components/app/common";
import { Button, Card, CardHeader, Checkbox, Dialog, Empty, Field, Input, Pill, Select, Textarea, Toggle } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import { contractorTotals } from "@/lib/selectors";
import type { Contractor } from "@/lib/types";

export default function ContractorsPage() {
  const { road, dispatch, now } = useRoad();
  const [editing, setEditing] = useState<Contractor | null>(null);
  const totals = contractorTotals(road, now.getFullYear());
  const w = road.settings.weather;

  return (
    <>
      <PageHeader
        title="Road"
        sub="Plow, grading and gravel companies, and what the road paid each this year."
        actions={
          <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setEditing({ id: uid("ctr"), name: "", trade: "", phone: "", email: "", w9OnFile: false, isCorporation: false, notes: "" })}>
            Add contractor
          </Button>
        }
      />
      <RoadNav />
      <Card className="mb-6">
        {road.contractors.length === 0 ? (
          <Empty title="No contractors yet">Add the companies that plow, grade and haul gravel for the road.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {road.contractors.map((c) => {
              const t = totals.find((x) => x.id === c.id);
              return (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{c.name}</p>
                    <p className="text-[0.92rem] text-stone">
                      {c.trade}
                      {t && t.paid > 0 && ` · paid ${money(t.paid)} in ${now.getFullYear()}`}
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
                  <div className="flex flex-wrap items-center gap-2">
                    {t?.needs1099 && <Pill tone="late">1099 needed</Pill>}
                    {!c.isCorporation && !c.w9OnFile && <Pill tone="warn">No W-9</Pill>}
                    <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Snow alerts" icon={<CloudSnow className="h-5 w-5" aria-hidden />} sub="Watches the National Weather Service forecast for the road and flags storms on the Home tab." />
        <div className="space-y-5 p-5">
          <Toggle checked={w.enabled} onChange={(v) => dispatch({ type: "road.settings", patch: { weather: { ...w, enabled: v } } })} label="Watch the forecast" />
          {w.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Alert when snow is forecast over" htmlFor="snow-in">
                <Select id="snow-in" value={w.snowInches} onChange={(e) => dispatch({ type: "road.settings", patch: { weather: { ...w, snowInches: Number(e.target.value) } } })}>
                  {[1, 2, 3, 4, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} inch{n === 1 ? "" : "es"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Plow contractor to text" htmlFor="snow-ctr">
                <Select id="snow-ctr" value={w.contractorId ?? ""} onChange={(e) => dispatch({ type: "road.settings", patch: { weather: { ...w, contractorId: e.target.value || null } } })}>
                  <option value="">None</option>
                  {road.contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </div>
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
        <Checkbox checked={c.w9OnFile} onChange={(v) => set({ w9OnFile: v })} label="W-9 on file" hint="Needed to send a 1099 if the road pays them $2,000 or more in a year." />
        <Checkbox checked={c.isCorporation} onChange={(v) => set({ isCorporation: v })} label="It's a corporation" hint="Corporations generally don't get a 1099-NEC." />
        <Field label="Notes" optional htmlFor="c-notes">
          <Textarea id="c-notes" rows={2} value={c.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
