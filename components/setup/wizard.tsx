"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Landmark,
  MapPin,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { AmountInput } from "@/components/amount-input";
import { Logo } from "@/components/logo";
import { RoadStrip } from "@/components/road-strip";
import { CALC_KEY, type CalcDraft } from "@/components/share-calculator";
import { useToast } from "@/components/toast";
import { Button, Callout, Card, Checkbox, Choice, cx, Field, Input, Select, Textarea } from "@/components/ui";
import { ai, createRoad, getStatus } from "@/lib/client/backend";
import { blobToBase64 } from "@/lib/client/files";
import { shrinkImage } from "@/lib/client/image";
import { applyAll, type Command } from "@/lib/commands";
import { addDays, fmtDate, isoDate } from "@/lib/dates";
import { benchmarkRange, CATEGORY_LABEL, createRoad as buildRoad, newHome, suggestedBudget } from "@/lib/factory";
import { center as centerOf, fmtFeet, locateOnPath, pathLengthFt } from "@/lib/geo";
import { uid } from "@/lib/ids";
import { money } from "@/lib/money";
import { computeShares, METHOD_INFO } from "@/lib/split";
import { STATES, stateName } from "@/lib/states";
import { budgetSummary, messageTemplate } from "@/lib/templates";
import type { BudgetLine, DuesRequest, ExpenseCategory, Home, LatLng, SplitMethod, SplitSettings, Surface } from "@/lib/types";

const RoadMap = dynamic(() => import("@/components/road-map").then((m) => m.RoadMap), { ssr: false, loading: () => <div className="h-[360px] rounded-xl bg-paper-2" /> });

const DRAFT_KEY = "rf:wizard";

interface DraftHome {
  id: string;
  label: string;
  address: string;
  owners: string;
  phone: string;
  email: string;
  distanceFt: number | null;
  frontageFt: number | null;
  vacant: boolean;
  position: LatLng | null;
}

interface Draft {
  step: number;
  name: string;
  state: string;
  county: string;
  town: string;
  surface: Surface;
  lengthText: string;
  path: LatLng[];
  center: LatLng | null;
  homes: DraftHome[];
  meId: string | null;
  split: SplitSettings;
  bank: { connected: boolean; bankName: string; last4: string };
  budget: BudgetLine[];
  title: string;
  dueDate: string;
  message: string;
}

const STEPS = [
  { title: "Find your road", minutes: 2 },
  { title: "Confirm the homes", minutes: 3 },
  { title: "Pick how to split costs", minutes: 1 },
  { title: "Connect the road's bank account", minutes: 2 },
  { title: "This year's budget", minutes: 1 },
  { title: "Send the first dues request", minutes: 1 },
];

function blankHome(n: number): DraftHome {
  return { id: uid("home"), label: `Lot ${n}`, address: "", owners: "", phone: "", email: "", distanceFt: null, frontageFt: null, vacant: false, position: null };
}

function initialDraft(): Draft {
  const year = new Date().getFullYear();
  return {
    step: 1,
    name: "",
    state: "",
    county: "",
    town: "",
    surface: "gravel",
    lengthText: "",
    path: [],
    center: null,
    homes: [blankHome(1), blankHome(2), blankHome(3)],
    meId: null,
    split: { method: "equal", vacantWeight: 1, basePct: 0 },
    bank: { connected: false, bankName: "", last4: "" },
    budget: [],
    title: `${year} road dues`,
    dueDate: addDays(isoDate(), 30),
    message: "",
  };
}

const numOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** A saved draft, or the calculator's numbers when arriving from the share calculator. */
function restoreDraft(): { draft: Draft; fromCalculator: boolean } {
  try {
    const calc = sessionStorage.getItem(CALC_KEY);
    if (calc) {
      sessionStorage.removeItem(CALC_KEY);
      const c = JSON.parse(calc) as CalcDraft;
      return {
        fromCalculator: true,
        draft: {
          ...initialDraft(),
          homes: c.homes.map((h) => ({ ...blankHome(0), label: h.label, distanceFt: h.distanceFt, frontageFt: h.frontageFt, vacant: h.vacant })),
          split: { method: c.method === "custom" ? "equal" : c.method, vacantWeight: c.vacantWeight, basePct: c.basePct },
          budget: c.budget > 0 ? [{ id: uid("bud"), label: "Road budget", category: "other", amount: c.budget }] : [],
          lengthText: String(Math.max(0, ...c.homes.map((h) => h.distanceFt ?? 0)) || ""),
        },
      };
    }
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) return { fromCalculator: false, draft: { ...initialDraft(), ...(JSON.parse(saved) as Draft) } };
  } catch {}
  return { fromCalculator: false, draft: initialDraft() };
}

export function SetupWizard() {
  const router = useRouter();
  const toast = useToast();
  // This component only renders in the browser (see wizard-loader), so storage can be read up front.
  const [restored] = useState(restoreDraft);
  const [d, setD] = useState<Draft>(restored.draft);
  const [errors, setErrors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (restored.fromCalculator) toast("Your calculator numbers are filled in. Add your road's name to start.", "info");
  }, [restored.fromCalculator, toast]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [d]);

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const pathLen = d.path.length > 1 ? Math.round(pathLengthFt(d.path) / 10) * 10 : null;
  const lengthFt = pathLen ?? numOrNull(d.lengthText) ?? 0;
  const budgetTotal = d.budget.reduce((a, b) => a + b.amount, 0);
  const splitHomes = d.homes.map((h) => ({ id: h.id, label: h.label, frontageFt: h.frontageFt, distanceFt: h.distanceFt, customPct: null, vacant: h.vacant }));
  const shares = useMemo(() => computeShares(budgetTotal || 300_000, splitHomes, d.split), [budgetTotal, d.homes, d.split]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (step: number): string[] => {
    const e: string[] = [];
    if (step === 1) {
      if (!d.name.trim()) e.push("Give the road a name.");
      if (!d.state) e.push("Pick the state.");
      if (!d.county.trim()) e.push("Add the county. It's where the agreement gets recorded.");
      if (!lengthFt) e.push("Draw the road on the map or type about how long it is.");
    }
    if (step === 2) {
      if (d.homes.length < 2) e.push("A shared road needs at least 2 homes.");
      const blank = d.homes.filter((h) => !h.label.trim());
      if (blank.length) e.push("Every home needs a name or address.");
      if (!d.meId) e.push("Mark which home is yours.");
    }
    if (step === 3 && !shares.ok) e.push(...shares.problems);
    if (step === 5 && budgetTotal <= 0) e.push("Add at least one budget line.");
    if (step === 6) {
      if (!d.title.trim()) e.push("Give the request a title.");
      if (!d.dueDate) e.push("Pick a due date.");
    }
    return e;
  };

  const go = (step: number) => {
    if (step > d.step) {
      for (let s = d.step; s < step; s++) {
        const e = validate(s);
        if (e.length) {
          setErrors(e);
          return;
        }
      }
    }
    setErrors([]);
    if (step === 5 && d.budget.length === 0) set({ step, budget: suggestedBudget(lengthFt, d.surface) });
    else set({ step });
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const finish = async (sendNow: boolean) => {
    for (let s = 1; s <= 6; s++) {
      const e = validate(s);
      if (e.length) {
        setErrors(e);
        set({ step: s });
        return;
      }
    }
    setCreating(true);
    try {
      const at = new Date().toISOString();
      const homes: Home[] = d.homes.map((h) =>
        newHome({ id: h.id, label: h.label.trim(), address: h.address.trim(), owners: h.owners.trim(), phone: h.phone.trim(), email: h.email.trim(), distanceFt: h.distanceFt, frontageFt: h.frontageFt, vacant: h.vacant, position: h.position }, at),
      );
      let road = buildRoad({ name: d.name, state: d.state, county: d.county, town: d.town, surface: d.surface, lengthFt, homes, captainHomeId: d.meId }, at);
      road = { ...road, path: d.path, center: d.center ?? centerOf(d.path) };
      const final = computeShares(budgetTotal, homes, d.split);
      const request: DuesRequest = {
        id: uid("req"),
        title: d.title.trim(),
        kind: "annual",
        createdAt: at,
        dueDate: d.dueDate,
        total: budgetTotal,
        budget: d.budget,
        split: d.split,
        lines: final.lines.map((l) => ({ homeId: l.homeId, amount: l.amount, reason: l.reason })),
        message: d.message,
        status: "open",
        sentAt: null,
      };
      const cmds: Command[] = [{ type: "road.split", split: d.split }, { type: "road.budget", budget: d.budget }, { type: "request.create", request }];
      if (d.bank.connected) cmds.unshift({ type: "account.connect", bankName: d.bank.bankName, last4: d.bank.last4 });
      const me = homes.find((h) => h.id === d.meId);
      road = applyAll(road, cmds, { at, actor: { kind: "captain", homeId: d.meId, name: me?.owners || me?.label || "Road captain" } });
      const { entry } = await createRoad(road);
      localStorage.removeItem(DRAFT_KEY);
      toast(`${road.name} is set up.`);
      router.replace(sendNow ? `/app/money/requests/${request.id}?send=1` : `/app?welcome=${entry.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't create the road.", "error");
      setCreating(false);
    }
  };

  const minutesLeft = STEPS.slice(d.step - 1).reduce((a, s) => a + s.minutes, 0);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="Road Fund home">
            <Logo />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[0.95rem] font-semibold text-stone hover:bg-paper-2">
            <X className="h-5 w-5" aria-hidden /> Save and exit
          </Link>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="flex items-center justify-between text-[0.9rem]">
            <span className="font-semibold">
              Step {d.step} of 6 · {STEPS[d.step - 1].title}
            </span>
            <span className="text-stone">About {minutesLeft} min left</span>
          </div>
          <ol className="mt-2 grid grid-cols-6 gap-1.5" aria-label="Setup steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => i + 1 < d.step && go(i + 1)}
                  disabled={i + 1 >= d.step}
                  className={cx("block h-2 w-full rounded-full", i + 1 < d.step ? "bg-pine" : i + 1 === d.step ? "bg-sign" : "bg-line")}
                  aria-label={`Step ${i + 1}: ${s.title}${i + 1 < d.step ? " (done, go back)" : ""}`}
                />
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 pb-36 pt-8" ref={top}>
        <h1 className="text-[2rem] font-black leading-tight">{STEPS[d.step - 1].title}</h1>
        {errors.length > 0 && (
          <Callout tone="danger" className="mt-4" title="Fix this to continue">
            <ul className="list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Callout>
        )}

        <div className="mt-6">
          {d.step === 1 && <StepRoad d={d} set={set} pathLen={pathLen} />}
          {d.step === 2 && <StepHomes d={d} set={set} />}
          {d.step === 3 && <StepSplit d={d} set={set} shares={shares} budgetTotal={budgetTotal} lengthFt={lengthFt} goHomes={() => go(2)} />}
          {d.step === 4 && <StepBank d={d} set={set} />}
          {d.step === 5 && <StepBudget d={d} set={set} lengthFt={lengthFt} shares={shares} />}
          {d.step === 6 && <StepSend d={d} set={set} shares={shares} budgetTotal={budgetTotal} />}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {d.step > 1 && (
            <Button variant="secondary" onClick={() => go(d.step - 1)} icon={<ArrowLeft className="h-5 w-5" aria-hidden />} aria-label="Back">
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}
          {d.step < 6 ? (
            <Button className="flex-1" size="lg" onClick={() => go(d.step + 1)} icon={<ArrowRight className="h-5 w-5" aria-hidden />}>
              {d.step === 4 && !d.bank.connected ? "Skip for now" : "Continue"}
            </Button>
          ) : (
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Button className="flex-1" size="lg" loading={creating} onClick={() => finish(true)}>
                Create road and send
              </Button>
              <Button variant="ghost" onClick={() => finish(false)} disabled={creating}>
                Send later
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

type StepProps = { d: Draft; set: (p: Partial<Draft>) => void };

function StepRoad({ d, set, pathLen }: StepProps & { pathLen: number | null }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number; county: string; state: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(d.path.length > 0);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setSearching(true);
    setSearchNote(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const body = (await res.json()) as { results: typeof results; error?: string };
      setResults(body.results);
      if (!body.results.length) setSearchNote(body.error ?? "No match. Try the nearest public road and town, then tap the map.");
    } catch {
      setSearchNote("Search didn't answer. Tap the map to place your road instead.");
    } finally {
      setSearching(false);
    }
  };

  const pick = (r: (typeof results)[number]) => {
    const code = STATES.find((s) => s.name === r.state)?.code ?? d.state;
    set({ center: { lat: r.lat, lng: r.lng }, state: d.state || code, county: d.county || r.county });
    setResults([]);
    setDrawing(true);
  };

  return (
    <div className="space-y-6">
      <Field label="Road name" hint="What neighbors call it. It appears on bills and letters." htmlFor="w-name">
        <Input id="w-name" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Birch Hollow Lane" autoComplete="off" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="State" htmlFor="w-state">
          <Select id="w-state" value={d.state} onChange={(e) => set({ state: e.target.value })}>
            <option value="">Choose…</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="County" htmlFor="w-county">
          <Input id="w-county" value={d.county} onChange={(e) => set({ county: e.target.value })} />
        </Field>
        <Field label="Town" optional htmlFor="w-town">
          <Input id="w-town" value={d.town} onChange={(e) => set({ town: e.target.value })} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 font-semibold">Road surface</legend>
        <Choice
          name="surface"
          columns={2}
          value={d.surface}
          onChange={(v) => set({ surface: v })}
          options={[
            { value: "gravel", label: "Gravel" },
            { value: "dirt", label: "Dirt" },
            { value: "chip-seal", label: "Chip seal" },
            { value: "paved", label: "Paved" },
          ]}
        />
      </fieldset>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[1.15rem] font-bold">
          <Route className="h-5 w-5 text-pine" aria-hidden /> Put the road on the map
        </h2>
        <p className="mt-1 text-stone">Optional, but it measures the road and each driveway for you. Search for an address on the road, then tap from the entrance to the far end.</p>
        <form onSubmit={search} className="mt-4 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="An address on or near the road" aria-label="Search for an address" />
          <Button type="submit" variant="secondary" loading={searching} icon={<Search className="h-5 w-5" aria-hidden />}>
            <span className="hidden sm:inline">Search</span>
          </Button>
        </form>
        {searchNote && <p className="mt-2 text-[0.92rem] text-stone">{searchNote}</p>}
        {results.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" onClick={() => pick(r)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-paper">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-pine" aria-hidden />
                  <span className="text-[0.95rem]">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!drawing ? (
          <Button variant="ghost" className="mt-3" onClick={() => setDrawing(true)}>
            Open the map
          </Button>
        ) : (
          <div className="mt-4 space-y-3">
            <RoadMap center={d.center} path={d.path} mode="draw" onAddPoint={(p) => set({ path: [...d.path, p] })} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto font-semibold">
                {d.path.length === 0 ? "Tap where your road meets the public road." : d.path.length === 1 ? "Now tap along the road toward the far end." : `Road length: ${fmtFeet(pathLen ?? 0)}`}
              </span>
              <Button size="sm" variant="secondary" icon={<Undo2 className="h-4 w-4" aria-hidden />} onClick={() => set({ path: d.path.slice(0, -1) })} disabled={!d.path.length}>
                Undo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => set({ path: [] })} disabled={!d.path.length}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </Card>

      {d.path.length < 2 && (
        <Field label="About how long is the road?" hint="From the public road to the last driveway. A football field is 300 ft; a mile is 5,280 ft." htmlFor="w-length">
          <Input id="w-length" inputMode="numeric" suffix="feet" value={d.lengthText} onChange={(e) => set({ lengthText: e.target.value })} className="max-w-xs" />
        </Field>
      )}
    </div>
  );
}

function StepHomes({ d, set }: StepProps) {
  const [open, setOpen] = useState<string | null>(d.homes[0]?.id ?? null);
  const [placing, setPlacing] = useState<string | null>(null);
  const canPlace = d.path.length > 1;
  const update = (id: string, patch: Partial<DraftHome>) => set({ homes: d.homes.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
  const unplaced = d.homes.filter((h) => !h.position);

  const place = (p: LatLng) => {
    if (!placing) return;
    const loc = locateOnPath(d.path, p);
    const homes = d.homes.map((h) => (h.id === placing ? { ...h, position: p, distanceFt: loc ? Math.round(loc.alongFt / 10) * 10 : h.distanceFt } : h));
    set({ homes });
    const next = homes.find((h) => !h.position && h.id !== placing);
    setPlacing(next?.id ?? null);
  };

  return (
    <div className="space-y-6">
      <p className="text-stone">
        List every lot that uses the road, including vacant lots. Only you see phone numbers and emails. In the live product, homes and owners come from county parcel
        records; here, type them in.
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-card">
        <span className="font-semibold">How many lots use the road?</span>
        <Select
          value={d.homes.length}
          onChange={(e) => {
            const n = Number(e.target.value);
            const homes = n > d.homes.length ? [...d.homes, ...Array.from({ length: n - d.homes.length }, (_, i) => blankHome(d.homes.length + i + 1))] : d.homes.slice(0, n);
            set({ homes, meId: homes.some((h) => h.id === d.meId) ? d.meId : null });
          }}
          className="w-28"
          aria-label="Number of lots"
        >
          {Array.from({ length: 39 }, (_, i) => i + 2).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>

      {canPlace && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-[1.15rem] font-bold">
            <MapPin className="h-5 w-5 text-pine" aria-hidden /> Place driveways on the map
          </h2>
          <p className="mt-1 text-stone">Pick a home, then tap where its driveway meets the road. Distance from the entrance fills in.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.homes.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setPlacing(h.id)}
                className={cx(
                  "rounded-full border-2 px-3 py-1.5 text-[0.9rem] font-semibold",
                  placing === h.id ? "border-sign bg-sign text-charcoal" : h.position ? "border-pine bg-pine-50 text-pine" : "border-line bg-white",
                )}
              >
                {h.position && <Check className="mr-1 inline h-4 w-4" aria-hidden />}
                {h.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <RoadMap
              center={d.center}
              path={d.path}
              mode={placing ? "place" : "view"}
              onPlace={place}
              pins={d.homes
                .filter((h) => h.position)
                .map((h, i) => ({ id: h.id, position: h.position!, label: String(i + 1), title: h.label, tone: h.id === placing ? "selected" : h.id === d.meId ? "me" : "home" }))}
            />
          </div>
          <p className="mt-2 text-[0.92rem] text-stone">
            {placing ? `Tap the map for ${d.homes.find((h) => h.id === placing)?.label}.` : unplaced.length ? `${unplaced.length} not placed yet.` : "All homes placed."}
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {d.homes.map((h, i) => {
          const isOpen = open === h.id;
          return (
            <li key={h.id} className={cx("rounded-[var(--radius-card)] border bg-white shadow-card", d.meId === h.id ? "border-pine" : "border-line")}>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={() => setOpen(isOpen ? null : h.id)} aria-expanded={isOpen}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-display font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {h.label || "Unnamed"}
                    {h.vacant && <span className="ml-2 text-[0.85rem] font-normal text-stone">vacant</span>}
                    {d.meId === h.id && <span className="ml-2 rounded bg-pine px-1.5 py-0.5 text-[0.75rem] font-bold text-white">You</span>}
                  </span>
                  <span className="block truncate text-[0.9rem] text-stone">{[h.owners, h.distanceFt !== null ? `${h.distanceFt.toLocaleString()} ft in` : ""].filter(Boolean).join(" · ") || "Tap to add details"}</span>
                </span>
                <span className="text-stone">{isOpen ? "Close" : "Edit"}</span>
              </button>
              {isOpen && (
                <div className="space-y-4 border-t border-line px-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Lot name or number" htmlFor={`h-label-${h.id}`}>
                      <Input id={`h-label-${h.id}`} value={h.label} onChange={(e) => update(h.id, { label: e.target.value })} />
                    </Field>
                    <Field label="Address" optional htmlFor={`h-addr-${h.id}`}>
                      <Input id={`h-addr-${h.id}`} value={h.address} onChange={(e) => update(h.id, { address: e.target.value })} autoComplete="off" />
                    </Field>
                    <Field label="Owner name(s)" optional htmlFor={`h-own-${h.id}`}>
                      <Input id={`h-own-${h.id}`} value={h.owners} onChange={(e) => update(h.id, { owners: e.target.value })} placeholder="Tom & Linda Becker" autoComplete="off" />
                    </Field>
                    <Field label="Mobile phone" optional htmlFor={`h-ph-${h.id}`}>
                      <Input id={`h-ph-${h.id}`} type="tel" value={h.phone} onChange={(e) => update(h.id, { phone: e.target.value })} autoComplete="off" />
                    </Field>
                    <Field label="Email" optional htmlFor={`h-em-${h.id}`}>
                      <Input id={`h-em-${h.id}`} type="email" value={h.email} onChange={(e) => update(h.id, { email: e.target.value })} autoComplete="off" />
                    </Field>
                    <Field label="Driveway distance from entrance" optional htmlFor={`h-d-${h.id}`}>
                      <Input id={`h-d-${h.id}`} inputMode="numeric" suffix="ft" value={h.distanceFt ?? ""} onChange={(e) => update(h.id, { distanceFt: numOrNull(e.target.value) })} />
                    </Field>
                    <Field label="Frontage along the road" optional htmlFor={`h-f-${h.id}`}>
                      <Input id={`h-f-${h.id}`} inputMode="numeric" suffix="ft" value={h.frontageFt ?? ""} onChange={(e) => update(h.id, { frontageFt: numOrNull(e.target.value) })} />
                    </Field>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                      <Checkbox checked={d.meId === h.id} onChange={(v) => set({ meId: v ? h.id : null })} label="This is my home" />
                      <Checkbox checked={h.vacant} onChange={(v) => update(h.id, { vacant: v })} label="Vacant lot" />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-brick hover:bg-brick-50"
                      icon={<Trash2 className="h-4 w-4" aria-hidden />}
                      disabled={d.homes.length <= 2}
                      onClick={() => set({ homes: d.homes.filter((x) => x.id !== h.id), meId: d.meId === h.id ? null : d.meId })}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        icon={<Plus className="h-5 w-5" aria-hidden />}
        onClick={() => {
          const h = blankHome(d.homes.length + 1);
          set({ homes: [...d.homes, h] });
          setOpen(h.id);
        }}
        disabled={d.homes.length >= 40}
      >
        Add a lot
      </Button>
      <Callout tone="info" title="About texts">
        Road Fund sends automatic texts only to neighbors who agree to them from their own pay page. Until they do, you send their link from your phone or by email,
        or print a letter.
      </Callout>
    </div>
  );
}

function StepSplit({ d, set, shares, budgetTotal, lengthFt, goHomes }: StepProps & { shares: ReturnType<typeof computeShares>; budgetTotal: number; lengthFt: number; goHomes: () => void }) {
  const methods: SplitMethod[] = ["equal", "segment", "distance", "frontage"];
  const usesBase = d.split.method !== "equal";
  return (
    <div className="space-y-6">
      <Choice
        name="split"
        value={d.split.method}
        onChange={(m) => set({ split: { ...d.split, method: m, basePct: m === "equal" ? 0 : d.split.basePct || (m === "segment" ? 50 : 0) } })}
        options={methods.map((m) => ({
          value: m,
          label: METHOD_INFO[m].name,
          hint: `${METHOD_INFO[m].short}${METHOD_INFO[m].needs ? ` Needs ${METHOD_INFO[m].needs}.` : ""}`,
          badge: m === "segment" ? <span className="rounded bg-sign-50 px-1.5 py-0.5 text-[0.75rem] font-bold text-sign-ink">Fairest on dead-end roads</span> : undefined,
        }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vacant lots pay" htmlFor="w-vacant">
          <Select id="w-vacant" value={d.split.vacantWeight} onChange={(e) => set({ split: { ...d.split, vacantWeight: Number(e.target.value) } })}>
            <option value={1}>A full share</option>
            <option value={0.5}>Half a share</option>
            <option value={0.25}>A quarter share</option>
            <option value={0}>Nothing</option>
          </Select>
        </Field>
        {usesBase && (
          <Field label="Base share" hint="Part of the budget split evenly first." htmlFor="w-base">
            <Select id="w-base" value={d.split.basePct} onChange={(e) => set({ split: { ...d.split, basePct: Number(e.target.value) } })}>
              <option value={0}>None</option>
              <option value={25}>25%</option>
              <option value={50}>50%</option>
              <option value={75}>75%</option>
            </Select>
          </Field>
        )}
      </div>
      {!shares.ok ? (
        <Callout tone="warn" title="Missing details for this method" action={<Button size="sm" variant="secondary" onClick={goHomes}>Add them in step 2</Button>}>
          {shares.problems.join(" ")}
        </Callout>
      ) : (
        <Card>
          <div className="border-b border-line px-5 py-3">
            <p className="font-bold">{budgetTotal ? `Shares of ${money(budgetTotal)}` : "Example: shares of a $3,000 year"}</p>
            <p className="text-[0.9rem] text-stone">You&apos;ll set the real budget in step 5.</p>
          </div>
          {(d.split.method === "segment" || d.split.method === "distance") && shares.stretches.length > 0 && (
            <div className="border-b border-line px-5 py-4">
              <RoadStrip homes={d.homes} stretches={shares.stretches} lengthFt={lengthFt} />
            </div>
          )}
          <ul className="divide-y divide-line">
            {shares.lines.map((l) => (
              <li key={l.homeId} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                <span className="font-semibold">{l.label}</span>
                <span>
                  <span className="tnum font-bold">{money(l.amount)}</span>
                  <span className="tnum ml-2 text-[0.88rem] text-stone">{l.pct.toFixed(1)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StepBank({ d, set }: StepProps) {
  const [connecting, setConnecting] = useState(false);
  const connect = () => {
    setConnecting(true);
    window.setTimeout(() => {
      set({ bank: { connected: true, bankName: "Test Bank", last4: "6789" } });
      setConnecting(false);
    }, 900);
  };
  return (
    <div className="space-y-6">
      <p className="text-[1.05rem]">
        Neighbors&apos; payments go straight into an account in the road&apos;s name. Road Fund never holds the money. Stripe handles the account and checks the
        details; you&apos;ll need the road group&apos;s name, your name as the representative, and the bank account the road uses.
      </p>
      {d.bank.connected ? (
        <Callout tone="ok" title={`Connected: ${d.bank.bankName} ••${d.bank.last4}`} action={<Button size="sm" variant="ghost" onClick={() => set({ bank: { connected: false, bankName: "", last4: "" } })}>Disconnect</Button>}>
          Online payments are on. Bank payments settle in about 4 business days, cards in about 2.
        </Callout>
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-pine-50 p-2.5 text-pine">
              <Landmark className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="font-bold">{d.name || "Your road"} road account</p>
              <p className="text-[0.92rem] text-stone">Stripe Connect · test mode</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 rounded-xl bg-paper p-4 text-[0.95rem] sm:grid-cols-2">
            <div>
              <dt className="text-stone">Routing number</dt>
              <dd className="tnum font-semibold">110000000</dd>
            </div>
            <div>
              <dt className="text-stone">Account number</dt>
              <dd className="tnum font-semibold">000123456789</dd>
            </div>
          </dl>
          <p className="mt-3 text-[0.92rem] text-stone">These are Stripe&apos;s public test numbers. No real account is connected and no money moves.</p>
          <Button className="mt-4" block loading={connecting} onClick={connect} icon={<ShieldCheck className="h-5 w-5" aria-hidden />}>
            Connect test account
          </Button>
        </Card>
      )}
      <p className="text-stone">You can skip this. Neighbors can still see their share and pay you by check; you record it in the ledger.</p>
    </div>
  );
}

function StepBudget({ d, set, lengthFt, shares }: StepProps & { lengthFt: number; shares: ReturnType<typeof computeShares> }) {
  const toast = useToast();
  const [reading, setReading] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  useEffect(() => {
    getStatus().then((s) => setAiOn(s.ai));
  }, []);
  const bench = benchmarkRange(lengthFt);
  const total = d.budget.reduce((a, b) => a + b.amount, 0);
  const homes = d.homes.length;
  const update = (id: string, patch: Partial<BudgetLine>) => set({ budget: d.budget.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const readInvoice = async (file: File) => {
    setReading(true);
    try {
      const blob = file.type === "application/pdf" ? file : await shrinkImage(file, 2000, 0.85);
      const res = await ai<{ vendor: string; total: number; description: string; category: string }>({ task: "invoice", mime: blob.type, data: await blobToBase64(blob) });
      if (!res.ok || !res.data) throw new Error(res.error);
      const cat = (Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).includes(res.data.category as ExpenseCategory) ? (res.data.category as ExpenseCategory) : "other";
      set({ budget: [...d.budget, { id: uid("bud"), label: `${res.data.description || res.data.vendor} (last year)`, category: cat, amount: Math.round(res.data.total * 100) }] });
      toast(`Read ${res.data.vendor}: ${money(Math.round(res.data.total * 100))}. Check the line below.`);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Couldn't read that invoice. Type the amount instead.", "error");
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-stone">
        Starting numbers are scaled to your road&apos;s length. Replace them with last year&apos;s bills or this year&apos;s quotes.
        {d.surface === "gravel" || d.surface === "dirt"
          ? ` For reference, maintaining a gravel road runs about $5,650 to $6,850 per mile a year; for ${fmtFeet(lengthFt)} that's ${money(bench.low)} to ${money(bench.high)}.`
          : ""}
      </p>
      <ul className="space-y-2.5">
        {d.budget.map((b) => (
          <li key={b.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line bg-white p-3 sm:grid-cols-[1.4fr_1fr_8.5rem_auto] sm:items-center">
            <Input aria-label="What it's for" value={b.label} onChange={(e) => update(b.id, { label: e.target.value })} className="col-span-2 sm:col-span-1" />
            <Select aria-label="Category" value={b.category} onChange={(e) => update(b.id, { category: e.target.value as ExpenseCategory })}>
              {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
            <AmountInput value={b.amount} onChange={(amount) => update(b.id, { amount })} label={`${b.label} amount`} />
            <button type="button" className="justify-self-end rounded-lg p-2 text-stone hover:bg-brick-50 hover:text-brick" onClick={() => set({ budget: d.budget.filter((x) => x.id !== b.id) })} aria-label={`Remove ${b.label}`}>
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => set({ budget: [...d.budget, { id: uid("bud"), label: "", category: "other", amount: 0 }] })}>
          Add a line
        </Button>
        {aiOn && (
          <label className={cx("inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-pine/80 bg-white px-3.5 text-[0.9rem] font-semibold text-pine hover:bg-pine-50", reading && "opacity-60")}>
            <Camera className="h-4 w-4" aria-hidden />
            {reading ? "Reading…" : "Read last year's invoice"}
            <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={reading} onChange={(e) => e.target.files?.[0] && readInvoice(e.target.files[0])} />
          </label>
        )}
      </div>
      <Card className="p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-bold">This year&apos;s total</span>
          <span className="tnum font-display text-[1.6rem] font-black">{money(total)}</span>
        </div>
        {shares.ok && total > 0 && (
          <p className="mt-1 text-stone">
            {d.split.method === "equal" ? `About ${money(Math.round(total / homes))} per home` : `From ${money(Math.min(...computeShares(total, d.homes.map((h) => ({ ...h, customPct: null })), d.split).lines.map((l) => l.amount)))} to ${money(Math.max(...computeShares(total, d.homes.map((h) => ({ ...h, customPct: null })), d.split).lines.map((l) => l.amount)))} per home`}
          </p>
        )}
      </Card>
    </div>
  );
}

function StepSend({ d, set, shares, budgetTotal }: StepProps & { shares: ReturnType<typeof computeShares>; budgetTotal: number }) {
  const me = d.homes.find((h) => h.id === d.meId);
  const final = computeShares(budgetTotal, d.homes.map((h) => ({ ...h, customPct: null })), d.split);
  const sample = final.lines[0];
  const preview =
    d.message ||
    messageTemplate("dues", {
      roadName: d.name,
      captainName: me?.owners || "",
      recipientName: d.homes[0]?.owners || undefined,
      amount: sample?.amount,
      dueDate: d.dueDate,
      title: d.title,
      budgetSummary: budgetSummary(d.budget.map((b) => b.label)),
      link: "roadfund.app/n/…",
    });
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="w-title">
          <Input id="w-title" value={d.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Due date" htmlFor="w-due" hint={d.dueDate ? fmtDate(d.dueDate) : undefined}>
          <Input id="w-due" type="date" value={d.dueDate} min={isoDate()} onChange={(e) => set({ dueDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Message" hint="Each neighbor's name, amount and link are filled in automatically. Edit it on the next screen if you want." htmlFor="w-msg">
        <Textarea id="w-msg" value={preview} readOnly rows={5} className="bg-paper" />
      </Field>
      <Card>
        <div className="border-b border-line px-5 py-3">
          <p className="font-bold">Summary</p>
        </div>
        <dl className="divide-y divide-line">
          {[
            ["Road", `${d.name}, ${d.county} County, ${stateName(d.state)}`],
            ["Homes", `${d.homes.length} (${d.homes.filter((h) => h.vacant).length} vacant)`],
            ["Split", `${METHOD_INFO[d.split.method].name}${d.split.basePct && d.split.method !== "equal" ? `, ${d.split.basePct}% base share` : ""}`],
            ["Total", money(budgetTotal)],
            ["Bank account", d.bank.connected ? `${d.bank.bankName} ••${d.bank.last4}` : "Not connected; checks only for now"],
            ["Due", d.dueDate ? fmtDate(d.dueDate) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-5 py-2.5">
              <dt className="text-stone">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {!shares.ok && <Callout tone="danger">{shares.problems.join(" ")}</Callout>}
      <p className="text-stone">The free Starter plan covers one dues request a year. You can upgrade later from Settings.</p>
    </div>
  );
}
