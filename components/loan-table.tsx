import { Check, CircleHelp, Minus, X } from "lucide-react";
import { LOAN_RULES, type LoanRule } from "@/lib/states";

const ICON: Record<LoanRule["needsAgreement"], React.ReactNode> = {
  yes: <Check className="h-5 w-5 text-brick" aria-hidden />,
  no: <X className="h-5 w-5 text-pine" aria-hidden />,
  unclear: <CircleHelp className="h-5 w-5 text-sign-ink" aria-hidden />,
  varies: <Minus className="h-5 w-5 text-stone" aria-hidden />,
};

export function LoanTable() {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white" tabIndex={0} role="region" aria-label="Loan types and road requirements">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">Which mortgage types require a private road maintenance agreement, October 2026</caption>
        <thead className="bg-paper">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Loan type
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Needs a road maintenance agreement?
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              What it does need
            </th>
          </tr>
        </thead>
        <tbody>
          {LOAN_RULES.map((r) => (
            <tr key={r.loan} className="border-t border-line align-top">
              <th scope="row" className="px-4 py-3 font-bold">
                {r.loan}
              </th>
              <td className="px-4 py-3">
                <span className="flex items-start gap-2">
                  <span className="mt-0.5">{ICON[r.needsAgreement]}</span>
                  <span className="font-semibold">{r.answer}</span>
                </span>
              </td>
              <td className="px-4 py-3 text-stone">
                {r.needs}
                <span className="mt-1 block text-[0.85rem]">Source: {r.source}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
