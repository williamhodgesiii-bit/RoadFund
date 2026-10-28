// Older saved roads may carry fields from features that were retired (the
// Plus plan, contractor bids, snow alerts, the savings planner). This brings
// any saved road up to the current shape when it's read.

import type { Road } from "./types.ts";

type Loose = Road & Record<string, unknown>;

export function normalizeRoad(input: Road): Road {
  const r = { ...(input as Loose) };
  if ((r.plan as string) === "plus") r.plan = "roadfund";
  delete r.bids;
  if (r.settings) {
    const { weather: _w, defaultPayMethod: _d, ...settings } = r.settings as Road["settings"] & { weather?: unknown; defaultPayMethod?: unknown };
    void _w;
    void _d;
    r.settings = settings;
  }
  r.reserve = { setAside: r.reserve?.setAside ?? 0 };
  return r;
}
