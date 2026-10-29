"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Bell, Cloud, Copy, CreditCard, Download, HardDrive, LogOut, Mail, Trash2, Type, Upload } from "lucide-react";
import { BillingReturn, PageHeader, PlanBadge, useBuy } from "@/components/app/common";
import { Button, Callout, Card, CardHeader, cx, Field, Input, Select, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";
import { captainLink, createRoad, deleteRoad, signOut } from "@/lib/client/backend";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { perHomeText, planPrice } from "@/lib/pricing";
import { captainHome } from "@/lib/selectors";
import { copyText, downloadFile } from "@/lib/client/links";
import { listRoads, removeEntry, setActiveId, type RoadEntry } from "@/lib/client/registry";
import { useRoad } from "@/lib/client/road-context";
import { uid, roadCode, secretToken } from "@/lib/ids";
import { STATES } from "@/lib/states";
import type { Road, Surface } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const { road, entry, status, dispatch, live } = useRoad();
  const toast = useToast();
  const buy = useBuy();
  const cap = captainHome(road);
  const [capEmail, setCapEmail] = useState(cap?.email ?? "");
  const canSend = (status.email || status.sms) && entry.where === "cloud" && !road.demo;
  const [name, setName] = useState(road.name);
  const [state, setState] = useState(road.state);
  const [county, setCounty] = useState(road.county);
  const [town, setTown] = useState(road.town);
  const [surface, setSurface] = useState<Surface>(road.surface);
  const [easementRef, setEasementRef] = useState(road.easementRef ?? "");
  const [allWeather, setAllWeather] = useState<"" | "yes" | "no">(road.allWeather === true ? "yes" : road.allWeather === false ? "no" : "");
  const [large, setLarge] = useState(() => typeof document !== "undefined" && document.documentElement.getAttribute("data-text") === "large");
  const [roads] = useState<RoadEntry[]>(() => (typeof window === "undefined" ? [] : listRoads()));
  const fileInput = useRef<HTMLInputElement>(null);

  const setTextSize = (big: boolean) => {
    setLarge(big);
    if (big) document.documentElement.setAttribute("data-text", "large");
    else document.documentElement.removeAttribute("data-text");
    try {
      localStorage.setItem("rf:text", big ? "large" : "normal");
    } catch {}
  };

  const capLink = captainLink(entry);

  const importRoad = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Road;
      if (data.schema !== 1 || !Array.isArray(data.homes)) throw new Error("That isn't a Road Fund backup.");
      // Import as a copy with fresh ids and links so it can't collide with the original.
      const copy: Road = { ...data, id: uid("road"), code: roadCode(), homes: data.homes.map((h) => ({ ...h, token: secretToken() })) };
      await createRoad(copy);
      toast(`Imported ${copy.name}.`);
      window.dispatchEvent(new Event("rf:switch-road"));
      router.push("/app");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed.", "error");
    }
  };

  return (
    <>
      <PageHeader title="Settings" sub={`${road.name} · road code ${road.code}`} />
      <BillingReturn />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Road details" />
          <div className="space-y-4 p-5">
            <Field label="Road name" htmlFor="s-name">
              <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="State" htmlFor="s-state">
                <Select id="s-state" value={state} onChange={(e) => setState(e.target.value)}>
                  {STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="County" htmlFor="s-county">
                <Input id="s-county" value={county} onChange={(e) => setCounty(e.target.value)} />
              </Field>
              <Field label="Town" optional htmlFor="s-town">
                <Input id="s-town" value={town} onChange={(e) => setTown(e.target.value)} />
              </Field>
              <Field label="Surface" htmlFor="s-surface">
                <Select id="s-surface" value={surface} onChange={(e) => setSurface(e.target.value as Surface)}>
                  <option value="gravel">Gravel</option>
                  <option value="dirt">Dirt</option>
                  <option value="chip-seal">Chip seal</option>
                  <option value="paved">Paved</option>
                </Select>
              </Field>
              <Field label="Open all year?" htmlFor="s-allweather" hint="Can an ordinary car get through in mud season and winter? Lenders ask.">
                <Select id="s-allweather" value={allWeather} onChange={(e) => setAllWeather(e.target.value as "" | "yes" | "no")}>
                  <option value="">Not sure</option>
                  <option value="yes">Yes, all year</option>
                  <option value="no">No, it can close</option>
                </Select>
              </Field>
              <Field label="Where the easement is recorded" optional htmlFor="s-easement" hint="Book and page or document number from the deed. Shown on Road Status Letters." className="sm:col-span-2">
                <Input id="s-easement" value={easementRef} onChange={(e) => setEasementRef(e.target.value)} placeholder="Liber 412, Page 88" />
              </Field>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                dispatch({ type: "road.update", patch: { name, state, county, town, surface, easementRef: easementRef.trim(), allWeather: allWeather === "" ? null : allWeather === "yes" } }, "Road details saved.")
              }
            >
              Save details
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Plan"
            icon={<CreditCard className="h-5 w-5" aria-hidden />}
            action={<PlanBadge plan={road.plan} />}
            sub={
              road.plan === "roadfund" && road.billing?.paidThrough
                ? `Paid through ${fmtDate(road.billing.paidThrough)}. Renews once a year.`
                : live
                  ? "Billed once a year. Most roads pay it from dues."
                  : "Test mode: switch freely, nothing is charged."
            }
          />
          <div className="space-y-3 p-5">
            {road.plan === "starter" ? (
              <>
                <p>
                  The free plan covers one bill a year with automatic reminders, recording checks, the payment record and the road agreement. Road Fund adds as many bills
                  as you need, mailed late notices and payment plans, paying contractors, votes, the work log and documents.
                </p>
                <Button block loading={buy.busy === "plan"} onClick={() => buy.upgrade()}>
                  Upgrade for {money(planPrice(road.homes.length)).replace(".00", "")} a year
                </Button>
                <p className="text-[0.95rem] text-stone">That&apos;s {perHomeText(road.homes.length)} for {road.homes.length} homes.</p>
              </>
            ) : (
              <p>Your road has everything: as many bills as you need, mailed late notices, payment plans, contractor payments, votes, the work log and documents.</p>
            )}
            {live && road.billing?.customerId && (
              <Button block variant="ghost" loading={buy.busy === "portal"} onClick={() => buy.portal()}>
                Receipts, card on file and cancelling
              </Button>
            )}
            {!live && road.plan === "roadfund" && (
              <Button block variant="ghost" onClick={() => dispatch({ type: "road.plan", plan: "starter" }, "Back on the free plan.")}>
                Switch back to the free plan
              </Button>
            )}
            {buy.note && <p className="text-[0.9rem] text-stone">{buy.note}</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Automatic reminders" icon={<Bell className="h-5 w-5" aria-hidden />} sub="Road Fund nudges neighbors who haven't paid, so you don't have to." />
          <div className="space-y-4 p-5">
            <Toggle
              checked={road.settings.autoReminders !== false}
              onChange={(v) => dispatch({ type: "road.settings", patch: { autoReminders: v } }, v ? "Automatic reminders on." : "Automatic reminders off.")}
              label="Send reminders for me"
              hint="3 days before the due date, then 7 and 21 days after, only to homes that still owe. Homes on a payment plan, with a payment on its way, or with a check in the mail are skipped."
            />
            {!canSend && (
              <p className="rounded-xl bg-paper p-3 text-[0.92rem] text-stone">
                {road.demo ? "The sample road never sends real messages." : "Reminders go out once email or texting is set up for this site. Until then, send them yourself from the dues page."}
              </p>
            )}
          </div>
        </Card>

        {entry.where === "cloud" && !road.demo && (
          <Card>
            <CardHeader title="Your sign-in" icon={<Mail className="h-5 w-5" aria-hidden />} sub="Lost your phone or got a new computer? Sign in with this email." />
            <div className="space-y-4 p-5">
              <Field label="Captain's email" htmlFor="cap-email" hint={status.email ? "We email a one-time sign-in link here. No password to remember." : "Saved for when email sign-in is turned on. Keep your captain link safe in the meantime."}>
                <Input id="cap-email" type="email" autoComplete="email" value={capEmail} onChange={(e) => setCapEmail(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={!cap || capEmail.trim() === (cap?.email ?? "")}
                  onClick={() => cap && dispatch({ type: "home.contact", homeId: cap.id, patch: { email: capEmail.trim() } }, "Email saved.")}
                >
                  Save email
                </Button>
                <Button
                  variant="ghost"
                  icon={<LogOut className="h-5 w-5" aria-hidden />}
                  onClick={async () => {
                    if (!window.confirm("Sign out of this road on this device? You'll need your email or captain link to get back in.")) return;
                    try {
                      await signOut(entry);
                    } catch {}
                    removeEntry(entry.id);
                    window.dispatchEvent(new Event("rf:switch-road"));
                    router.push("/signin");
                  }}
                >
                  Sign out on this device
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Text size" icon={<Type className="h-5 w-5" aria-hidden />} sub="Saved on this device." />
          <div className="grid grid-cols-2 gap-3 p-5">
            {[false, true].map((big) => (
              <button
                key={String(big)}
                onClick={() => setTextSize(big)}
                className={cx("rounded-xl border-2 p-4 text-left", large === big ? "border-pine bg-pine-50/60" : "border-line bg-white")}
                aria-pressed={large === big}
              >
                <span className={cx("block font-bold", big ? "text-[1.35rem]" : "text-[1.1rem]")}>Aa</span>
                <span className="text-[0.95rem]">{big ? "Larger" : "Standard"}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Where this road is saved"
            icon={entry.where === "cloud" ? <Cloud className="h-5 w-5" aria-hidden /> : <HardDrive className="h-5 w-5" aria-hidden />}
            sub={entry.where === "cloud" ? "Cloud storage: links work on any device." : "This browser only."}
          />
          <div className="space-y-4 p-5">
            {capLink ? (
              <>
                <p>Open the road on another phone or computer with your private captain link. Anyone with it can manage the road, so keep it to yourself.</p>
                <Button variant="secondary" icon={<Copy className="h-5 w-5" aria-hidden />} onClick={async () => (await copyText(capLink)) && toast("Captain link copied.")}>
                  Copy captain link
                </Button>
              </>
            ) : (
              <p className="text-stone">
                {status.cloud
                  ? "Cloud storage is on for this deployment, but this road was created before it was. Download a backup and import it to move it to the cloud."
                  : "To share neighbor links with real phones, add Upstash Redis to this Vercel project. Until then, download a backup to keep a copy."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Download className="h-5 w-5" aria-hidden />} onClick={() => downloadFile(`${road.name.replace(/\W+/g, "-").toLowerCase()}-backup.json`, JSON.stringify(road, null, 2), "application/json")}>
                Download backup
              </Button>
              <Button variant="ghost" icon={<Upload className="h-5 w-5" aria-hidden />} onClick={() => fileInput.current?.click()}>
                Import a backup
              </Button>
              <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label="Backup file to import" onChange={(e) => e.target.files?.[0] && importRoad(e.target.files[0])} />
            </div>
            <ul className="space-y-1 text-[0.92rem] text-stone">
              <li>Payments: {status.stripe === "live" ? "Stripe, live" : status.stripe === "test" ? "Stripe test mode (no real money)" : "simulated"}{road.demo && status.stripe ? " (the demo road is always simulated)" : ""}</li>
              <li>Email from Road Fund: {status.email ? "on" : "off"}</li>
              <li>Texts from Road Fund: {status.sms ? "on" : "off"}</li>
              <li>Filling in bills from a photo: {status.ai ? "on" : "off"}</li>
            </ul>
          </div>
        </Card>

        <Card id="roads">
          <CardHeader title="Roads in this browser" />
          <ul className="divide-y divide-line">
            {roads.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span>
                  <span className="block font-semibold">{r.name}</span>
                  <span className="block text-[0.88rem] text-stone">
                    {r.where === "cloud" ? "Cloud" : "This browser"}
                    {r.demo && " · demo"}
                  </span>
                </span>
                {r.id === entry.id ? (
                  <span className="text-[0.9rem] font-semibold text-pine">Open now</span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setActiveId(r.id);
                      window.dispatchEvent(new Event("rf:switch-road"));
                      router.push("/app");
                    }}
                  >
                    Switch
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-5">
            <Button variant="ghost" onClick={() => router.push("/start")}>
              Set up another road
            </Button>
            {entry.demo && (
              <Button variant="ghost" onClick={() => router.push("/demo?fresh=1")}>
                Reset the sample road
              </Button>
            )}
          </div>
        </Card>

        <Card className="border-brick/30">
          <CardHeader title="Delete this road" />
          <div className="space-y-3 p-5">
            <p className="text-stone">Removes the road, its payment record and its documents{entry.where === "cloud" ? " from the cloud" : " from this browser"}. Neighbor links stop working. This can&apos;t be undone.</p>
            <Callout tone="warn">Download a backup first if you might need the records.</Callout>
            <Button
              variant="danger"
              icon={<Trash2 className="h-5 w-5" aria-hidden />}
              onClick={async () => {
                if (window.prompt(`Type the road name to delete it: ${road.name}`) !== road.name) return;
                try {
                  await deleteRoad(entry);
                  removeEntry(entry.id);
                  toast("Road deleted.");
                  window.dispatchEvent(new Event("rf:switch-road"));
                  router.push("/app");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Delete failed.", "error");
                }
              }}
            >
              Delete road
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
