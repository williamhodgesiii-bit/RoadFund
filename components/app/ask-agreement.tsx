"use client";

import { useState } from "react";
import { MessageCircleQuestion, Sparkles } from "lucide-react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import { useToast } from "@/components/toast";
import { searchAgreement, type AgreementSection } from "@/lib/agreement";
import { ai } from "@/lib/client/backend";
import { AiBadge } from "./common";

/**
 * Answers questions from the road's own agreement. With AI on, a short answer
 * quoting the text; otherwise the best-matching sections. Works for captains
 * and neighbors (pass aiOn explicitly where there is no road context).
 */
export function AskAgreement({ sections, compact = false, aiOn }: { sections: AgreementSection[]; compact?: boolean; aiOn: boolean }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; sections: string[]; attorney: boolean; ai: boolean } | null>(null);
  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    if (aiOn) {
      const text = sections.map((s) => `${s.title}\n${s.body.join("\n")}`).join("\n\n");
      const res = await ai<{ answer: string; sections: string[]; needsAttorney: boolean }>({ task: "ask", question: q, agreement: text });
      setBusy(false);
      if (res.ok && res.data) return setAnswer({ text: res.data.answer, sections: res.data.sections, attorney: res.data.needsAttorney, ai: true });
      toast(res.error ?? "Couldn't answer.", "error");
    }
    const hits = searchAgreement(sections, q);
    setBusy(false);
    setAnswer(
      hits.length
        ? { text: hits.map((h) => `${h.section.title}: ${h.section.body.join(" ")}`).join("\n\n"), sections: hits.map((h) => h.section.title), attorney: false, ai: false }
        : { text: "The agreement doesn't seem to cover that. Ask the road captain or an attorney.", sections: [], attorney: true, ai: false },
    );
  };
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Ask the agreement {aiOn && <AiBadge />}
          </span>
        }
        icon={<MessageCircleQuestion className="h-5 w-5" aria-hidden />}
        sub={compact ? undefined : "Answers come only from this agreement's text."}
      />
      <form onSubmit={ask} className="space-y-3 p-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Can we pave without everyone agreeing?" aria-label="Your question" />
        <Button type="submit" size="sm" variant="secondary" loading={busy} icon={<Sparkles className="h-4 w-4" aria-hidden />}>
          Ask
        </Button>
        {answer && (
          <div className="space-y-2 rounded-xl bg-paper p-3 text-[0.95rem]">
            <p className="whitespace-pre-line">{answer.text}</p>
            {answer.sections.length > 0 && <p className="text-[0.85rem] text-stone">From: {answer.sections.join(", ")}</p>}
            {answer.attorney && <p className="text-[0.85rem] font-semibold text-sign-ink">This one is worth asking an attorney.</p>}
            {!answer.ai && <p className="text-[0.82rem] text-stone">Matched sections shown. Turn on AI for a plain-English answer.</p>}
          </div>
        )}
      </form>
    </Card>
  );
}
