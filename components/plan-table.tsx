import { Check, Minus } from "lucide-react";
import { money } from "@/lib/money";
import { LETTER_FEE, PLAN_LARGE, PLAN_SMALL, SMALL_ROAD_HOMES } from "@/lib/pricing";

const $ = (c: number) => money(c).replace(".00", "");

type Cell = string | boolean;
const ROWS: [string, Cell, Cell][] = [
  ["Price", "$0", `${$(PLAN_SMALL)} a year for up to ${SMALL_ROAD_HOMES} homes, ${$(PLAN_LARGE)} for 9 to 30`],
  ["Bills to neighbors", "One a year", "As many as the road needs, including one-time project bills"],
  ["Reminders to homes that haven't paid", true, true],
  ["Record checks and cash", true, true],
  ["Payment record every neighbor can see", true, true],
  ["Draft the road agreement and collect signatures", true, true],
  ["Mailed late notices, payment plans, small-claims packet", false, true],
  ["Pay the plow and grading bills from road money", false, true],
  ["Votes neighbors answer from their phone", false, true],
  ["Work log with photos, and the road's documents", false, true],
];

/** The two plans side by side, as a plain table. */
export function PlanTable() {
  return (
    <div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-charcoal">
            <th scope="col" className="w-[40%] py-3 pr-3 font-bold">
              <span className="sr-only">What you get</span>
            </th>
            <th scope="col" className="w-[20%] py-3 pr-3 text-[1.15rem] font-extrabold">
              Free
            </th>
            <th scope="col" className="py-3 text-[1.15rem] font-extrabold">
              Road Fund plan
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ROWS.map(([what, free, paid]) => (
            <tr key={what} className="align-top">
              <th scope="row" className="py-3 pr-3 font-semibold">
                {what}
              </th>
              <td className="py-3 pr-3">
                <Mark v={free} />
              </td>
              <td className="py-3">
                <Mark v={paid} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-5 space-y-1.5 text-[1.02rem]">
        <li>Each online payment: $1 to Road Fund, plus Stripe&apos;s fee of 0.8% from a checking account (at most $5) or 2.9% + 30¢ by card.</li>
        <li>Checks and cash: always free.</li>
        <li>Road Status Letter for a home sale: {$(LETTER_FEE)}, paid by whoever asks for it. Never the road.</li>
        <li>No setup fee, and neighbors never need an account. Most roads add the plan to the yearly budget, so it&apos;s shared like the plow bill.</li>
      </ul>
    </div>
  );
}

function Mark({ v }: { v: Cell }) {
  if (v === true) return <Check className="h-6 w-6 text-pine" aria-label="Included" />;
  if (v === false) return <Minus className="h-6 w-6 text-field" aria-label="Not included" />;
  return <span>{v}</span>;
}
