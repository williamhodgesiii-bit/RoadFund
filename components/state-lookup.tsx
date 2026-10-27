"use client";

import { useState } from "react";
import { BookOpen, TriangleAlert } from "lucide-react";
import { defaultLaw, RON_UNAVAILABLE, STATES, stateName } from "@/lib/states";
import { Field, Select } from "./ui";

export function StateLookup() {
  const [code, setCode] = useState("");
  const law = code ? defaultLaw(code) : null;
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card">
      <Field label="Your state" htmlFor="state-pick">
        <Select id="state-pick" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-sm">
          <option value="">Choose a state…</option>
          {STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {code && (
        <div className="mt-5 space-y-4" aria-live="polite">
          {law ? (
            <div className="flex gap-3 rounded-xl bg-pine-50 p-4">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-pine" aria-hidden />
              <div>
                <p className="font-bold">
                  {stateName(code)} has a default road law: {law.citation}
                </p>
                <p className="mt-1">{law.rule}</p>
                <p className="mt-2 text-[0.95rem] text-stone">
                  Fannie Mae accepts a state default law in place of a written agreement, so closings here face less pressure. You still need a way to collect, keep
                  records and settle disagreements, and a written agreement can set clearer terms than the default.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl bg-sign-50 p-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-sign-ink" aria-hidden />
              <div>
                <p className="font-bold">{stateName(code)} isn&apos;t on our list of states with a default road law.</p>
                <p className="mt-1">
                  If that holds, buyers using conventional loans may need a recorded road maintenance agreement. Ask a local real estate attorney one question:
                  &ldquo;Does this state have a statute defining private road maintenance duties that Fannie Mae accepts?&rdquo;
                </p>
              </div>
            </div>
          )}
          <p className="text-[0.95rem] text-stone">
            Remote online notary: {RON_UNAVAILABLE.has(code) ? "not available in this state; signatures need an in-person notary." : "available, so owners can notarize by video."}
          </p>
        </div>
      )}
    </div>
  );
}
