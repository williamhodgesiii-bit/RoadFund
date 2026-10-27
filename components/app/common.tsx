"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, CircleAlert, Clock, FileText, ImageOff, LoaderCircle, Lock, Sparkles } from "lucide-react";
import { stripeAction, type StripeAction } from "@/lib/client/backend";
import { useRoad } from "@/lib/client/road-context";
import { fileUrl, saveFile } from "@/lib/client/files";
import { shrinkImage } from "@/lib/client/image";
import type { LineStatus } from "@/lib/selectors";
import type { Plan } from "@/lib/types";
import { Button, Card, cx, Pill } from "@/components/ui";
import { useToast } from "@/components/toast";

export function PageHeader({ title, sub, actions, back }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 font-semibold text-pine hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.9rem] font-black leading-tight">{title}</h1>
          {sub && <p className="mt-1 text-stone">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SubNav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Section" className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 rounded-xl bg-paper-2 p-1">
        {items.map((i) => {
          const on = path === i.href || (i.href !== items[0].href && path.startsWith(i.href));
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={on ? "page" : undefined}
                className={cx("flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.95rem] font-semibold", on ? "bg-white text-pine shadow-card" : "text-stone hover:text-charcoal")}
              >
                {i.label}
                {!!i.badge && <span className="rounded-full bg-brick px-1.5 text-[0.75rem] font-bold text-white">{i.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MoneyNav() {
  const { road } = useRoad();
  const bills = road.expenses.filter((e) => e.status === "awaiting-approval" || e.status === "approved").length;
  return (
    <SubNav
      items={[
        { href: "/app/money", label: "Dues" },
        { href: "/app/money/bills", label: "Bills", badge: bills },
        { href: "/app/money/ledger", label: "Ledger" },
        { href: "/app/money/account", label: "Account" },
        { href: "/app/money/taxes", label: "Taxes" },
      ]}
    />
  );
}

export function RoadNav() {
  const { road } = useRoad();
  const open = road.work.filter((w) => w.kind === "damage" && w.status === "open").length;
  return (
    <SubNav
      items={[
        { href: "/app/road", label: "Map & shares" },
        { href: "/app/road/work", label: "Work log", badge: open },
        { href: "/app/road/bids", label: "Bids" },
        { href: "/app/road/contractors", label: "Contractors" },
        { href: "/app/road/reserve", label: "Savings plan" },
      ]}
    />
  );
}

export function PapersNav() {
  const { road } = useRoad();
  const requests = road.letterRequests.filter((r) => r.status === "new").length;
  return (
    <SubNav
      items={[
        { href: "/app/papers", label: "Votes" },
        { href: "/app/papers/agreement", label: "Agreement" },
        { href: "/app/papers/letters", label: "Status letters", badge: requests },
        { href: "/app/papers/documents", label: "Documents" },
      ]}
    />
  );
}

const STATUS_TONE: Record<LineStatus, { tone: "paid" | "processing" | "late" | "due" | "warn" | "neutral"; icon: React.ReactNode }> = {
  paid: { tone: "paid", icon: <Check className="h-4 w-4" aria-hidden /> },
  processing: { tone: "processing", icon: <Clock className="h-4 w-4" aria-hidden /> },
  partial: { tone: "warn", icon: <Clock className="h-4 w-4" aria-hidden /> },
  plan: { tone: "warn", icon: <Clock className="h-4 w-4" aria-hidden /> },
  due: { tone: "due", icon: null },
  late: { tone: "late", icon: <CircleAlert className="h-4 w-4" aria-hidden /> },
  none: { tone: "neutral", icon: null },
};

const STATUS_LABEL: Record<LineStatus, string> = {
  paid: "Paid",
  processing: "Paid · clearing",
  partial: "Part paid",
  plan: "On a plan",
  due: "Not paid yet",
  late: "Late",
  none: "No bill",
};

export function StatusPill({ status }: { status: LineStatus }) {
  const s = STATUS_TONE[status];
  return (
    <Pill tone={s.tone} icon={s.icon}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}

const PLAN_RANK: Record<Plan, number> = { starter: 0, roadfund: 1, plus: 2 };
const PLAN_NAME: Record<Plan, string> = { starter: "Starter", roadfund: "Road Fund", plus: "Road Fund Plus" };
const PLAN_PRICE: Record<Plan, string> = { starter: "Free", roadfund: "$149/yr", plus: "$249/yr" };

export function hasPlan(current: Plan, needed: Plan): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[needed];
}

/** Shows the feature when the road's plan includes it; otherwise a plain upgrade card. */
/**
 * Buying a plan or the agreement package. With Stripe on, this goes through
 * Stripe Checkout; otherwise (test deployments, the demo road) it's simulated.
 */
export function useBuy() {
  const { road, entry, dispatch, live, status } = useRoad();
  const toast = useToast();
  const [busy, setBusy] = useState<"plan" | "agreement" | "portal" | null>(null);
  const redirect = async (kind: "plan" | "agreement" | "portal", body: StripeAction) => {
    setBusy(kind);
    try {
      const res = await stripeAction(entry, body);
      if (res.url) return window.location.assign(res.url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Checkout didn't open. Try again.", "error");
    }
    setBusy(null);
  };
  return {
    busy,
    live,
    note: live ? (status.stripe === "test" ? "Stripe test mode: use card 4242 4242 4242 4242, any future date and any CVC." : "") : "Test mode: no charge.",
    upgrade: (plan: Exclude<Plan, "starter">) =>
      live ? redirect("plan", { action: "plan", plan }) : dispatch({ type: "road.plan", plan }, `Upgraded to ${PLAN_NAME[plan]}.`),
    agreement: () => (live ? redirect("agreement", { action: "agreement" }) : dispatch({ type: "agreement.purchase" }, "Agreement package added (test mode, no charge).")),
    portal: () => (road.billing?.customerId ? redirect("portal", { action: "portal" }) : undefined),
  };
}

/** Handles the return from a Stripe purchase (?billing=cs_...). */
export function BillingReturn() {
  const { entry, replace, live } = useRoad();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const id = useSearchParams().get("billing");
  const done = useRef(false);
  useEffect(() => {
    if (!id || !live || done.current) return;
    done.current = true;
    router.replace(pathname);
    stripeAction(entry, { action: "confirm", sessionId: id })
      .then((res) => {
        if (res.road) replace(res.road);
        toast(res.paid ? "Payment received. Thank you." : "Stripe is still confirming the payment. This page updates when it's done.");
      })
      .catch((e) => toast(e instanceof Error ? e.message : "Couldn't confirm the payment.", "error"));
  }, [id, live]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function PlanGate({ needs, feature, children, pitch }: { needs: Plan; feature: string; pitch: React.ReactNode; children: React.ReactNode }) {
  const { road } = useRoad();
  const buy = useBuy();
  if (hasPlan(road.plan, needs) || needs === "starter") return <>{children}</>;
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <span className="rounded-xl bg-sign-50 p-3 text-sign-ink">
          <Lock className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.25rem] font-extrabold">{feature} is part of {PLAN_NAME[needs]}</h2>
          <div className="mt-1 text-stone">{pitch}</div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button loading={buy.busy === "plan"} onClick={() => buy.upgrade(needs)}>
              Upgrade to {PLAN_NAME[needs]} · {PLAN_PRICE[needs]}
            </Button>
            <span className="text-[0.9rem] text-stone">{buy.note || "Billed yearly. Most roads pay it from dues."}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PlanBadge({ plan }: { plan: Plan }) {
  return <span className="rounded-md bg-paper-2 px-2 py-0.5 text-[0.8rem] font-bold text-stone">{PLAN_NAME[plan]}</span>;
}

/** Thumbnail for a stored photo or PDF. */
export function FileThumb({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const { entry } = useRoad();
  return <StoredFileThumb where={entry.where} fileId={fileId} alt={alt} className={className} />;
}

export function StoredFileThumb({ where, fileId, alt, className }: { where: "local" | "cloud"; fileId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [isPdf, setIsPdf] = useState(false);
  useEffect(() => {
    let live = true;
    fileUrl(where, fileId).then(async (u) => {
      if (!live) return;
      setUrl(u);
      if (u && where === "local") {
        const blob = await fetch(u).then((r) => r.blob()).catch(() => null);
        if (live && blob?.type === "application/pdf") setIsPdf(true);
      }
    });
    return () => {
      live = false;
    };
  }, [where, fileId]);
  if (url === undefined) return <div className={cx("animate-pulse bg-paper-2", className)} />;
  if (url === null)
    return (
      <div className={cx("flex flex-col items-center justify-center gap-1 bg-paper-2 p-2 text-center text-[0.75rem] text-stone", className)}>
        <ImageOff className="h-5 w-5" aria-hidden /> Saved on another device
      </div>
    );
  if (isPdf)
    return (
      <a href={url} target="_blank" rel="noopener" className={cx("flex flex-col items-center justify-center gap-1 bg-paper-2 text-stone", className)}>
        <FileText className="h-6 w-6" aria-hidden /> PDF
      </a>
    );
  return (
    <a href={url} target="_blank" rel="noopener" className={cx("block overflow-hidden bg-paper-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="h-full w-full object-cover" onError={() => setIsPdf(true)} />
    </a>
  );
}

/** Photo/PDF picker that shrinks photos and stores them where the road lives. */
export function UploadButton({
  onUploaded,
  label = "Add photo",
  accept = "image/*",
  multiple = false,
  capture,
}: {
  onUploaded: (fileId: string, file: { name: string; type: string; size: number }) => void;
  label?: string;
  accept?: string;
  multiple?: boolean;
  capture?: boolean;
}) {
  const { entry } = useRoad();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files).slice(0, 6)) {
        const blob = f.type.startsWith("image/") ? await shrinkImage(f) : f;
        if (blob.size > 750_000 && entry.where === "cloud") throw new Error(`${f.name} is over 750 KB. Compress the PDF or upload a photo of it.`);
        const id = await saveFile(entry, blob);
        onUploaded(id, { name: f.name, type: blob.type, size: blob.size });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className={cx("inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-pine/80 bg-white px-3.5 text-[0.9rem] font-semibold text-pine hover:bg-pine-50", busy && "pointer-events-none opacity-60")}>
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
      {busy ? "Saving…" : label}
      <input type="file" accept={accept} multiple={multiple} capture={capture ? "environment" : undefined} className="sr-only" onChange={(e) => handle(e.target.files)} />
    </label>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-lake-50 px-1.5 py-0.5 text-[0.75rem] font-bold text-lake">
      <Sparkles className="h-3 w-3" aria-hidden /> AI
    </span>
  );
}

export function useAiOn(): boolean {
  const { status, road } = useRoad();
  return status.ai && hasPlan(road.plan, "roadfund");
}
