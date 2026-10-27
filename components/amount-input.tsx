"use client";

import { useState } from "react";
import { centsToInput, parseMoney } from "@/lib/money";
import { Input } from "./ui";

/** Dollar input that keeps the text the user typed but reports cents. */
export function AmountInput({ value, onChange, label, id }: { value: number; onChange: (cents: number) => void; label?: string; id?: string }) {
  const [text, setText] = useState(value ? centsToInput(value) : "");
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if ((parseMoney(text) ?? 0) !== value) setText(value ? centsToInput(value) : "");
  }
  return (
    <Input
      id={id}
      aria-label={label}
      inputMode="decimal"
      prefix="$"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const c = parseMoney(e.target.value);
        if (c !== null && c >= 0) onChange(c);
        if (e.target.value.trim() === "") onChange(0);
      }}
    />
  );
}
