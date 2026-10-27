"use client";

import { useParams } from "next/navigation";
import { Copy, Mail, Printer } from "lucide-react";
import { PageHeader } from "@/components/app/common";
import { LetterBody } from "@/components/app/letter-body";
import { Button, Card, Empty } from "@/components/ui";
import { useToast } from "@/components/toast";
import { copyText, mailtoHref } from "@/lib/client/links";
import { useRoad } from "@/lib/client/road-context";
import { fmtDate } from "@/lib/dates";

export default function LetterPage() {
  const { id } = useParams<{ id: string }>();
  const { road } = useRoad();
  const toast = useToast();
  const letter = road.letters.find((l) => l.id === id);
  if (!letter) return <Card><Empty title="Letter not found" /></Card>;
  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/verify/${letter.code}` : "";
  return (
    <>
      <div className="no-print">
        <PageHeader
          back={{ href: "/app/papers/letters", label: "Status letters" }}
          title={`Letter ${letter.code}`}
          sub={`${letter.snapshot.property.address || letter.snapshot.property.label} · valid until ${fmtDate(letter.validUntil)}`}
          actions={
            <>
              <Button icon={<Printer className="h-5 w-5" aria-hidden />} onClick={() => window.print()}>
                Print or save PDF
              </Button>
              {letter.requester.email && (
                <a
                  href={mailtoHref(
                    letter.requester.email,
                    `Road Status Letter ${letter.code}: ${letter.snapshot.property.address || letter.snapshot.roadName}`,
                    `Hi ${letter.requester.name.split(" ")[0] || ""},\n\nAttached is the Road Status Letter for ${letter.snapshot.property.address || letter.snapshot.property.label} on ${letter.snapshot.roadName}. You can verify it any time at ${verifyUrl}\n\nValid until ${fmtDate(letter.validUntil)}.\n\nThanks,\n${letter.snapshot.captain.name}`,
                  )}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-pine/80 bg-white px-5 font-semibold text-pine hover:bg-pine-50"
                >
                  <Mail className="h-5 w-5" aria-hidden /> Email it
                </a>
              )}
              <Button variant="ghost" icon={<Copy className="h-5 w-5" aria-hidden />} onClick={async () => (await copyText(verifyUrl)) && toast("Verification link copied.")}>
                Copy verify link
              </Button>
            </>
          }
        />
        <p className="mb-4 text-[0.92rem] text-stone">Print it, then choose &ldquo;Save as PDF&rdquo; to attach it to an email.</p>
      </div>
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-card sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <LetterBody letter={letter} />
      </div>
    </>
  );
}
