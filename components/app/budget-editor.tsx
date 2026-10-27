"use client";

import { Plus, Trash2 } from "lucide-react";
import { AmountInput } from "@/components/amount-input";
import { Button, Input, Select } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/factory";
import { uid } from "@/lib/ids";
import type { BudgetLine, ExpenseCategory } from "@/lib/types";

export function BudgetEditor({ lines, onChange }: { lines: BudgetLine[]; onChange: (lines: BudgetLine[]) => void }) {
  const update = (id: string, patch: Partial<BudgetLine>) => onChange(lines.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {lines.map((b) => (
          <li key={b.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line bg-white p-3 sm:grid-cols-[1.4fr_1fr_8.5rem_auto] sm:items-center">
            <Input aria-label="What it's for" value={b.label} onChange={(e) => update(b.id, { label: e.target.value })} className="col-span-2 sm:col-span-1" placeholder="Snow plowing" />
            <Select aria-label="Category" value={b.category} onChange={(e) => update(b.id, { category: e.target.value as ExpenseCategory })}>
              {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
            <AmountInput value={b.amount} onChange={(amount) => update(b.id, { amount })} label={`${b.label || "Line"} amount`} />
            <button type="button" className="justify-self-end rounded-lg p-2 text-stone hover:bg-brick-50 hover:text-brick" onClick={() => onChange(lines.filter((x) => x.id !== b.id))} aria-label={`Remove ${b.label}`}>
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => onChange([...lines, { id: uid("bud"), label: "", category: "other", amount: 0 }])}>
        Add a line
      </Button>
    </div>
  );
}
