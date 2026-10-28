"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button, Callout, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ai } from "@/lib/client/backend";
import { blobToBase64, saveFile } from "@/lib/client/files";
import { shrinkImage } from "@/lib/client/image";
import { useRoad } from "@/lib/client/road-context";
import { buildPayment } from "@/lib/commands";
import { addDays, fmtDate, fmtDateTime, isoDate } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/factory";
import { uid } from "@/lib/ids";
import { allocate, centsToInput, money, parseMoney } from "@/lib/money";
import { displayName } from "@/lib/selectors";
import type { DuesRequest, Expense, ExpenseCategory, Home, Payment } from "@/lib/types";
import { useAiOn } from "./common";

export function RecordPaymentDialog({ open, onClose, home, request, outstanding }: { open: boolean; onClose: () => void; home: Home; request: DuesRequest; outstanding: number }) {
  const { road, dispatch } = useRoad();
  const [amount, setAmount] = useState(centsToInput(outstanding));
  const [method, setMethod] = useState<"check" | "cash">("check");
  const [date, setDate] = useState(isoDate());
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const cents = parseMoney(amount);
    if (!cents || cents <= 0) return setErr("Enter the amount received.");
    // A check handed over today counts as received now; an earlier date is recorded at midday.
    const paidAt = date === isoDate() ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();
    const payment = buildPayment(road, { id: uid("pay"), homeId: home.id, requestId: request.id, amount: cents, method, payerName: displayName(home), note, recordedBy: "captain", paidAt });
    if (await dispatch({ type: "payment.record", payment }, `Recorded ${money(cents)} from ${displayName(home)}.`)) onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Record a payment from ${displayName(home)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Record payment</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-stone">For checks or cash handed to you. Online payments record themselves.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" error={err} htmlFor="rp-amount">
            <Input id="rp-amount" inputMode="decimal" prefix="$" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="How" htmlFor="rp-method">
            <Select id="rp-method" value={method} onChange={(e) => setMethod(e.target.value as "check" | "cash")}>
              <option value="check">Check</option>
              <option value="cash">Cash</option>
            </Select>
          </Field>
          <Field label="Date received" htmlFor="rp-date">
            <Input id="rp-date" type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={method === "check" ? "Check number" : "Note"} optional htmlFor="rp-note">
            <Input id="rp-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <p className="text-[0.9rem] text-stone">Owed on {request.title}: {money(outstanding)}. Deposit it into the road&apos;s account.</p>
      </div>
    </Dialog>
  );
}

export function PaymentPlanDialog({ open, onClose, home, request, outstanding }: { open: boolean; onClose: () => void; home: Home; request: DuesRequest; outstanding: number }) {
  const { dispatch } = useRoad();
  const [count, setCount] = useState(3);
  const [start, setStart] = useState(addDays(isoDate(), 7));
  const parts = allocate(outstanding, Array.from({ length: count }, () => 1));
  const installments = parts.map((amount, i) => {
    const d = new Date(`${start}T12:00:00`);
    d.setMonth(d.getMonth() + i);
    return { due: isoDate(d), amount };
  });
  const save = async () => {
    const ok = await dispatch(
      { type: "plan.create", plan: { id: uid("plan"), homeId: home.id, requestId: request.id, createdAt: new Date().toISOString(), installments, status: "active" } },
      `Payment plan set up for ${displayName(home)}.`,
    );
    if (ok) onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Payment plan for ${displayName(home)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Set up plan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-stone">Splits the {money(outstanding)} still owed into monthly payments. While the plan is current, the home shows as &ldquo;On a plan&rdquo; instead of late.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Number of payments" htmlFor="pp-count">
            <Select id="pp-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n} monthly payments
                </option>
              ))}
            </Select>
          </Field>
          <Field label="First payment" htmlFor="pp-start">
            <Input id="pp-start" type="date" value={start} min={isoDate()} onChange={(e) => setStart(e.target.value)} />
          </Field>
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {installments.map((i, n) => (
            <li key={n} className="flex justify-between px-4 py-2.5">
              <span>{fmtDate(i.due)}</span>
              <span className="tnum font-semibold">{money(i.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

export function ReceiptDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { road, dispatch } = useRoad();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  if (!payment) return null;
  const home = road.homes.find((h) => h.id === payment.homeId);
  const req = road.requests.find((r) => r.id === payment.requestId);
  const how = { ach: "Bank transfer", card: "Card", check: "Check", cash: "Cash" }[payment.method];
  return (
    <Dialog
      open={!!payment}
      onClose={onClose}
      title={`Receipt ${payment.receiptNo}`}
      footer={
        payment.status === "ok" && !voiding ? (
          <>
            <Button variant="ghost" className="text-brick hover:bg-brick-50" onClick={() => setVoiding(true)}>
              Void this payment
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
          </>
        ) : undefined
      }
    >
      <dl className="divide-y divide-line rounded-xl border border-line">
        {[
          ["Road", road.name],
          ["From", home ? `${displayName(home)} (${home.label})` : payment.payerName],
          ["For", req?.title ?? "Road dues"],
          ["Amount credited", money(payment.amount)],
          ...(payment.charged !== payment.amount ? [["Charged to payer", money(payment.charged)] as [string, string]] : []),
          ...(payment.platformFee || payment.processingFee ? [["Fees", `${money(payment.platformFee)} Road Fund + ${money(payment.processingFee)} processing`] as [string, string]] : []),
          ["Road received", money(payment.roadNet)],
          ["Method", `${how}${payment.note ? ` · ${payment.note}` : ""}`],
          ["Date", fmtDateTime(payment.paidAt)],
          ["Status", payment.status === "void" ? `Voided: ${payment.voidReason}` : new Date(payment.clearsAt) > new Date() ? `On its way, done by ${fmtDate(payment.clearsAt)}` : "Cleared"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-stone">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {voiding && (
        <div className="mt-4 space-y-3">
          <Callout tone="warn">Voiding removes the payment from the balance and marks the dues unpaid. The receipt stays in the history. Use this for a bounced check or a mistake.</Callout>
          <Field label="Reason" htmlFor="void-reason">
            <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Check returned by bank" />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setVoiding(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (await dispatch({ type: "payment.void", paymentId: payment.id, reason }, "Payment voided.")) onClose();
              }}
            >
              Void payment
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function AddBillDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: Partial<Expense> }) {
  const { road, entry, dispatch } = useRoad();
  const toast = useToast();
  const aiOn = useAiOn();
  const [contractorId, setContractorId] = useState(preset?.contractorId ?? "");
  const [vendor, setVendor] = useState(preset?.vendorName ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(preset?.category ?? "plowing");
  const [amount, setAmount] = useState(preset?.amount ? centsToInput(preset.amount) : "");
  const [date, setDate] = useState(isoDate());
  const [fileId, setFileId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setReading(true);
    try {
      const blob = file.type.startsWith("image/") ? await shrinkImage(file, 1800, 0.82) : file;
      setFileId(await saveFile(entry, blob));
      if (aiOn) {
        const res = await ai<{ vendor: string; total: number; date: string; description: string; category: string }>({ task: "invoice", mime: blob.type, data: await blobToBase64(blob) });
        if (res.ok && res.data) {
          const match = road.contractors.find((c) => c.name.toLowerCase().includes(res.data!.vendor.toLowerCase().split(" ")[0] ?? "~"));
          if (match) setContractorId(match.id);
          setVendor(match?.name ?? res.data.vendor);
          setDescription(res.data.description);
          if (res.data.total) setAmount(String(res.data.total));
          if (/^\d{4}-\d{2}-\d{2}$/.test(res.data.date)) setDate(res.data.date);
          if (res.data.category in CATEGORY_LABEL) setCategory(res.data.category as ExpenseCategory);
          toast("Filled in from the bill. Check the details before saving.");
        } else if (res.error) toast(res.error, "error");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed.", "error");
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    const cents = parseMoney(amount);
    const name = contractorId ? road.contractors.find((c) => c.id === contractorId)?.name ?? vendor : vendor;
    if (!name.trim()) return setErr("Who is the bill from?");
    if (!cents || cents <= 0) return setErr("Enter the bill amount.");
    const expense: Expense = {
      id: uid("exp"),
      contractorId: contractorId || null,
      vendorName: name.trim(),
      description: description.trim() || CATEGORY_LABEL[category],
      category,
      amount: cents,
      invoiceDate: date,
      createdAt: new Date().toISOString(),
      status: "awaiting-approval",
      approvedAt: null,
      paidAt: null,
      paidVia: null,
      invoiceFileId: fileId,
      workEntryId: preset?.workEntryId ?? null,
    };
    if (await dispatch({ type: "expense.create", expense }, "Bill added. Approve it when you're ready to pay.")) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a bill"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Add bill</Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed border-field bg-paper px-4 py-4">
          <span>
            <span className="flex items-center gap-2 font-semibold">
              {fileId ? "Bill attached" : "Take a photo of the bill"}
            </span>
            <span className="block text-[0.9rem] text-stone">{aiOn ? "The amount and date fill in from the photo. You check them." : "Kept with the bill as the receipt."}</span>
          </span>
          <span className="rounded-lg bg-white px-3 py-2 font-semibold text-pine shadow-card">{reading ? "Reading…" : fileId ? "Replace" : "Choose"}</span>
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} disabled={reading} />
        </label>
        {reading && aiOn && (
          <p className="flex items-center gap-2 text-[0.92rem] text-lake">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> Reading the bill…
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="bill-ctr">
            <Select id="bill-ctr" value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
              <option value="">Someone else…</option>
              {road.contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          {!contractorId && (
            <Field label="Vendor name" htmlFor="bill-vendor">
              <Input id="bill-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </Field>
          )}
          <Field label="Amount" error={err} htmlFor="bill-amount">
            <Input id="bill-amount" inputMode="decimal" prefix="$" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Category" htmlFor="bill-cat">
            <Select id="bill-cat" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date on the bill" htmlFor="bill-date">
            <Input id="bill-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="What was done" htmlFor="bill-desc">
          <Textarea id="bill-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Plowing, 6 visits in January" />
        </Field>
      </div>
    </Dialog>
  );
}
