"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Check, MapPin, Pencil, Route, Undo2 } from "lucide-react";
import { PageHeader, RoadNav } from "@/components/app/common";
import { RoadStrip } from "@/components/road-strip";
import { Button, Callout, Card, CardHeader, Choice, cx, Field, Input, Select } from "@/components/ui";
import { useRoad } from "@/lib/client/road-context";
import type { Command } from "@/lib/commands";
import { center as centerOf, fmtFeet, locateOnPath, pathLengthFt } from "@/lib/geo";
import { money } from "@/lib/money";
import { computeShares, METHOD_INFO } from "@/lib/split";
import { stateName } from "@/lib/states";
import type { Home, LatLng, SplitMethod, SplitSettings } from "@/lib/types";

import type { MapPin as Pin } from "@/components/road-map";

const RoadMap = dynamic(() => import("@/components/road-map").then((m) => m.RoadMap), { ssr: false, loading: () => <div className="h-[380px] rounded-xl bg-paper-2" /> });

export default function RoadPage() {
  const { road, dispatch } = useRoad();
  const [editing, setEditing] = useState<"none" | "draw" | "place">("none");
  const [path, setPath] = useState<LatLng[]>(road.path);
  const [placing, setPlacing] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { position: LatLng; distanceFt: number | null }>>({});
  const [split, setSplit] = useState<SplitSettings>(road.split);
  const [homes, setHomes] = useState<Home[]>(road.homes);
  const [lengthText, setLengthText] = useState(String(road.lengthFt || ""));

  const budget = road.budget.reduce((a, b) => a + b.amount, 0) || 300_000;
  const preview = useMemo(
    () => computeShares(budget, homes.map((h) => ({ id: h.id, label: h.label, frontageFt: h.frontageFt, distanceFt: h.distanceFt, customPct: h.customPct, vacant: h.vacant })), split),
    [budget, homes, split],
  );
  const splitDirty = split.method !== road.split.method || split.vacantWeight !== road.split.vacantWeight || split.basePct !== road.split.basePct;
  const homesDirty = JSON.stringify(homes.map((h) => [h.distanceFt, h.frontageFt, h.customPct, h.vacant])) !== JSON.stringify(road.homes.map((h) => [h.distanceFt, h.frontageFt, h.customPct, h.vacant]));

  const pins: Pin[] = road.homes
    .map((h, i): Pin | null => {
      const pos = positions[h.id]?.position ?? h.position;
      return pos ? { id: h.id, position: pos, label: String(i + 1), title: `${h.label}${h.owners ? ` · ${h.owners}` : ""}`, tone: h.id === placing ? "selected" : h.id === road.captainHomeId ? "me" : "home" } : null;
    })
    .filter((x): x is Pin => !!x)
    .concat(
      road.work
        .filter((w) => w.kind === "damage" && w.position && w.status !== "fixed")
        .map((w): Pin => ({ id: w.id, position: w.position!, label: "!", title: `Damage: ${w.title}`, tone: "damage" })),
    );

  const saveMap = async () => {
    const cmds: Command[] = [];
    const len = path.length > 1 ? Math.round(pathLengthFt(path) / 10) * 10 : road.lengthFt;
    cmds.push({ type: "road.update", patch: { path, lengthFt: len, center: centerOf(path) ?? road.center } });
    for (const [homeId, p] of Object.entries(positions)) cmds.push({ type: "home.update", homeId, patch: { position: p.position, distanceFt: p.distanceFt } });
    if (await dispatch(cmds, "Map saved.")) {
      setEditing("none");
      setPositions({});
      setHomes((hs) => hs.map((h) => (positions[h.id] ? { ...h, position: positions[h.id].position, distanceFt: positions[h.id].distanceFt } : h)));
    }
  };

  const place = (p: LatLng) => {
    if (!placing) return;
    const loc = locateOnPath(path, p);
    const distanceFt = loc ? Math.round(loc.alongFt / 10) * 10 : null;
    setPositions((x) => ({ ...x, [placing]: { position: p, distanceFt } }));
    const idx = road.homes.findIndex((h) => h.id === placing);
    setPlacing(road.homes[idx + 1]?.id ?? null);
  };

  return (
    <>
      <PageHeader title="Road" sub={`${road.name} · ${fmtFeet(road.lengthFt)} ${road.surface.replace("-", " ")} · ${road.county} County, ${stateName(road.state)}`} />
      <RoadNav />

      <Card className="mb-6">
        <CardHeader
          title="Map"
          icon={<Route className="h-5 w-5" aria-hidden />}
          sub={editing === "draw" ? "Tap from the entrance to the far end." : editing === "place" ? "Pick a home, then tap its driveway." : "Driveways, damage reports and the road line."}
          action={
            editing === "none" ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing("draw")}>
                  Redraw road
                </Button>
                {road.path.length > 1 && (
                  <Button size="sm" variant="secondary" icon={<MapPin className="h-4 w-4" aria-hidden />} onClick={() => { setEditing("place"); setPlacing(road.homes[0]?.id ?? null); }}>
                    Place homes
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditing("none"); setPath(road.path); setPositions({}); }}>
                  Cancel
                </Button>
                <Button size="sm" icon={<Check className="h-4 w-4" aria-hidden />} onClick={saveMap}>
                  Save
                </Button>
              </div>
            )
          }
        />
        <div className="space-y-3 p-4">
          {editing === "draw" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPath([])}>
                Start over
              </Button>
              <Button size="sm" variant="secondary" icon={<Undo2 className="h-4 w-4" aria-hidden />} onClick={() => setPath((p) => p.slice(0, -1))} disabled={!path.length}>
                Undo point
              </Button>
              <span className="ml-auto font-semibold">{path.length > 1 ? fmtFeet(pathLengthFt(path)) : "Tap the entrance first"}</span>
            </div>
          )}
          {editing === "place" && (
            <div className="flex flex-wrap gap-1.5">
              {road.homes.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setPlacing(h.id)}
                  className={cx("rounded-full border-2 px-3 py-1 text-[0.88rem] font-semibold", placing === h.id ? "border-sign bg-sign" : positions[h.id] || h.position ? "border-pine bg-pine-50 text-pine" : "border-line bg-white")}
                >
                  {h.label}
                </button>
              ))}
            </div>
          )}
          <RoadMap center={road.center} path={editing === "draw" ? path : road.path} pins={pins} mode={editing === "draw" ? "draw" : editing === "place" ? "place" : "view"} onAddPoint={(p) => setPath((x) => [...x, p])} onPlace={place} height={380} />
          {road.path.length < 2 && editing === "none" && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Road length" hint="Draw the road to measure it, or type it." htmlFor="road-len">
                <Input id="road-len" inputMode="numeric" suffix="ft" value={lengthText} onChange={(e) => setLengthText(e.target.value)} className="w-40" />
              </Field>
              <Button variant="secondary" onClick={() => dispatch({ type: "road.update", patch: { lengthFt: Number(lengthText) || road.lengthFt } }, "Saved.")}>
                Save length
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="How costs are split" sub="Used for new dues requests. Requests already sent keep the split they were sent with." />
        <div className="space-y-5 p-5">
          <Choice
            name="road-split"
            columns={2}
            value={split.method}
            onChange={(m: SplitMethod) => setSplit({ ...split, method: m })}
            options={(["equal", "segment", "distance", "frontage", "custom"] as SplitMethod[]).map((m) => ({ value: m, label: METHOD_INFO[m].name, hint: METHOD_INFO[m].short }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vacant lots pay" htmlFor="rs-vacant">
              <Select id="rs-vacant" value={split.vacantWeight} onChange={(e) => setSplit({ ...split, vacantWeight: Number(e.target.value) })}>
                <option value={1}>A full share</option>
                <option value={0.5}>Half a share</option>
                <option value={0.25}>A quarter share</option>
                <option value={0}>Nothing</option>
              </Select>
            </Field>
            {split.method !== "equal" && split.method !== "custom" && (
              <Field label="Base share" htmlFor="rs-base">
                <Select id="rs-base" value={split.basePct} onChange={(e) => setSplit({ ...split, basePct: Number(e.target.value) })}>
                  {[0, 25, 50, 75].map((p) => (
                    <option key={p} value={p}>
                      {p ? `${p}% split evenly` : "None"}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Shares by home">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-paper text-[0.88rem] text-stone">
                <tr>
                  <th className="px-4 py-2 font-semibold">Home</th>
                  <th className="px-2 py-2 font-semibold">Distance in</th>
                  <th className="px-2 py-2 font-semibold">{split.method === "custom" ? "Percent" : "Frontage"}</th>
                  <th className="px-2 py-2 font-semibold">Vacant</th>
                  <th className="px-4 py-2 text-right font-semibold">Share of {money(budget)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {homes.map((h) => {
                  const line = preview.lines.find((l) => l.homeId === h.id);
                  const set = (patch: Partial<Home>) => setHomes((hs) => hs.map((x) => (x.id === h.id ? { ...x, ...patch } : x)));
                  const num = (v: string) => (v.trim() === "" ? null : Number(v) >= 0 ? Number(v) : null);
                  return (
                    <tr key={h.id}>
                      <td className="px-4 py-2">
                        <p className="font-semibold">{h.label}</p>
                        <p className="text-[0.85rem] text-stone">{h.owners}</p>
                      </td>
                      <td className="px-2 py-2">
                        <Input aria-label={`${h.label} distance`} inputMode="numeric" suffix="ft" value={h.distanceFt ?? ""} onChange={(e) => set({ distanceFt: num(e.target.value) })} className="w-32" />
                      </td>
                      <td className="px-2 py-2">
                        {split.method === "custom" ? (
                          <Input aria-label={`${h.label} percent`} inputMode="decimal" suffix="%" value={h.customPct ?? ""} onChange={(e) => set({ customPct: num(e.target.value) })} className="w-28" />
                        ) : (
                          <Input aria-label={`${h.label} frontage`} inputMode="numeric" suffix="ft" value={h.frontageFt ?? ""} onChange={(e) => set({ frontageFt: num(e.target.value) })} className="w-32" />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input type="checkbox" checked={h.vacant} onChange={(e) => set({ vacant: e.target.checked })} className="h-6 w-6 accent-pine" aria-label={`${h.label} vacant`} />
                      </td>
                      <td className="tnum px-4 py-2 text-right font-bold">{line ? money(line.amount) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!preview.ok && <Callout tone="warn">{preview.problems.join(" ")}</Callout>}
          {preview.ok && preview.stretches.length > 0 && (split.method === "segment" || split.method === "distance") && <RoadStrip homes={homes} stretches={preview.stretches} lengthFt={road.lengthFt} />}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!(splitDirty || homesDirty) || !preview.ok}
              onClick={() => {
                const cmds: Command[] = [];
                if (splitDirty) cmds.push({ type: "road.split", split });
                for (const h of homes) {
                  const old = road.homes.find((x) => x.id === h.id)!;
                  if (old.distanceFt !== h.distanceFt || old.frontageFt !== h.frontageFt || old.customPct !== h.customPct || old.vacant !== h.vacant) {
                    cmds.push({ type: "home.update", homeId: h.id, patch: { distanceFt: h.distanceFt, frontageFt: h.frontageFt, customPct: h.customPct, vacant: h.vacant } });
                  }
                }
                dispatch(cmds, "Split saved. It applies to the next dues request.");
              }}
            >
              Save split
            </Button>
            {(splitDirty || homesDirty) && (
              <Button variant="ghost" onClick={() => { setSplit(road.split); setHomes(road.homes); }}>
                Undo changes
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
