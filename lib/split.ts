import { allocate, money } from "./money.ts";
import type { SplitMethod, SplitSettings } from "./types.ts";

export interface SplitHome {
  id: string;
  label: string;
  frontageFt: number | null;
  distanceFt: number | null;
  customPct: number | null;
  vacant: boolean;
}

export interface Stretch {
  fromFt: number;
  toFt: number;
  homeIds: string[];
}

export interface ShareLine {
  homeId: string;
  label: string;
  amount: number;
  /** Share of the total, 0–100. */
  pct: number;
  reason: string;
}

export interface SplitResult {
  ok: boolean;
  total: number;
  lines: ShareLine[];
  problems: string[];
  /** Road stretches and who drives each one (distance-based methods only). */
  stretches: Stretch[];
}

export const METHOD_INFO: Record<SplitMethod, { name: string; short: string; long: string; needs: string | null }> = {
  equal: {
    name: "Equal shares",
    short: "Every home pays the same.",
    long: "Simplest to explain. Works when homes are spread evenly along the road.",
    needs: null,
  },
  frontage: {
    name: "By road along your lot",
    short: "Pay by the feet of road along your property.",
    long: "Common in older deeds. Homes with more road along their lot pay more.",
    needs: "frontage in feet for each lot",
  },
  distance: {
    name: "By distance from the entrance",
    short: "Homes farther in pay more.",
    long: "Homes near the main road pay less. Each home's share is in proportion to its distance from the entrance.",
    needs: "each driveway's distance from the entrance",
  },
  segment: {
    name: "By how much road you drive",
    short: "The stretch everyone drives is shared by all. The far end is shared by the homes past it.",
    long: "Often the fairest split on a dead-end road: nobody pays for road they never drive. A base share keeps the homes near the entrance paying something.",
    needs: "each driveway's distance from the entrance",
  },
  custom: {
    name: "Your own percentages",
    short: "Use the percentages in your deed or agreement.",
    long: "Enter each home's percentage. They must add up to 100%.",
    needs: "a percentage for each home",
  },
};

const ft = (n: number) => `${Math.round(n).toLocaleString("en-US")} ft`;

function shareCountText(weights: number[]): string {
  const total = weights.reduce((a, b) => a + b, 0);
  const rounded = Math.round(total * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
}

export function computeShares(total: number, homes: SplitHome[], settings: SplitSettings): SplitResult {
  const problems: string[] = [];
  const vw = Math.min(1, Math.max(0, settings.vacantWeight));
  const lotWeight = (h: SplitHome) => (h.vacant ? vw : 1);
  const empty = (msg?: string): SplitResult => ({
    ok: false,
    total,
    lines: [],
    problems: msg ? [msg, ...problems] : problems,
    stretches: [],
  });

  if (homes.length === 0) return empty("Add the homes that use the road.");
  if (total < 0) return empty("The total can't be negative.");

  let weights: number[] = [];
  let reasons: string[] = [];
  let stretches: Stretch[] = [];

  switch (settings.method) {
    case "equal": {
      weights = homes.map(lotWeight);
      const count = shareCountText(weights);
      const hasVacant = homes.some((h) => h.vacant) && vw !== 1;
      reasons = homes.map((h) =>
        h.vacant && vw !== 1
          ? `Vacant lot: ${Math.round(vw * 100)}% of a full share (${count} shares in all).`
          : hasVacant
            ? `One full share of ${count} (vacant lots count as ${Math.round(vw * 100)}%).`
            : `One of ${count} equal shares.`,
      );
      break;
    }
    case "frontage": {
      const missing = homes.filter((h) => !(h.frontageFt && h.frontageFt > 0));
      if (missing.length) {
        return empty(`Add frontage (feet along the road) for ${missing.map((h) => h.label).join(", ")}.`);
      }
      const totalFrontage = homes.reduce((a, h) => a + (h.frontageFt ?? 0), 0);
      weights = homes.map((h) => (h.frontageFt ?? 0) * lotWeight(h));
      reasons = homes.map(
        (h) =>
          `${ft(h.frontageFt ?? 0)} of frontage out of ${ft(totalFrontage)} on the road` +
          (h.vacant && vw !== 1 ? `, counted at ${Math.round(vw * 100)}% because the lot is vacant.` : "."),
      );
      break;
    }
    case "distance":
    case "segment": {
      const missing = homes.filter((h) => h.distanceFt === null || h.distanceFt === undefined || h.distanceFt < 0);
      if (missing.length) {
        return empty(`Add the driveway distance from the entrance for ${missing.map((h) => h.label).join(", ")}.`);
      }
      const atZero = homes.filter((h) => (h.distanceFt ?? 0) === 0);
      if (atZero.length === homes.length) return empty("Every driveway is at 0 ft. Enter how far in each driveway is.");

      stretches = buildStretches(homes);

      if (settings.method === "distance") {
        if (atZero.length) {
          problems.push(`${atZero.map((h) => h.label).join(", ")} ${atZero.length === 1 ? "is" : "are"} at 0 ft and would pay nothing by distance.`);
        }
        weights = homes.map((h) => (h.distanceFt ?? 0) * lotWeight(h));
        const far = Math.max(...homes.map((h) => h.distanceFt ?? 0));
        reasons = homes.map(
          (h) =>
            `Driveway is ${ft(h.distanceFt ?? 0)} in; the farthest is ${ft(far)}. Share is in proportion to distance` +
            (h.vacant && vw !== 1 ? `, counted at ${Math.round(vw * 100)}% because the lot is vacant.` : "."),
        );
      } else {
        const raw = new Map<string, number>(homes.map((h) => [h.id, 0]));
        const byId = new Map(homes.map((h) => [h.id, h]));
        for (const s of stretches) {
          const len = s.toFt - s.fromFt;
          const w = s.homeIds.reduce((a, id) => a + lotWeight(byId.get(id)!), 0);
          if (w <= 0) continue;
          for (const id of s.homeIds) raw.set(id, raw.get(id)! + (len * lotWeight(byId.get(id)!)) / w);
        }
        weights = homes.map((h) => raw.get(h.id)!);
        reasons = homes.map((h) => segmentReason(h, stretches, vw));
      }
      break;
    }
    case "custom": {
      const missing = homes.filter((h) => h.customPct === null || h.customPct === undefined || h.customPct < 0);
      if (missing.length) return empty(`Add a percentage for ${missing.map((h) => h.label).join(", ")}.`);
      const sumPct = homes.reduce((a, h) => a + (h.customPct ?? 0), 0);
      if (Math.abs(sumPct - 100) > 0.05) {
        return empty(`Percentages add up to ${Math.round(sumPct * 100) / 100}%. They need to add up to 100%.`);
      }
      weights = homes.map((h) => h.customPct ?? 0);
      reasons = homes.map((h) => `Set by the road's agreement at ${h.customPct}%.`);
      break;
    }
  }

  // Optional base share: part of the total split evenly, the rest by the method.
  const base = settings.method === "equal" || settings.method === "custom" ? 0 : Math.min(100, Math.max(0, settings.basePct ?? 0)) / 100;
  const lotWeights = homes.map(lotWeight);
  const baseTotal = Math.round(total * base);
  const baseParts = base > 0 ? allocate(baseTotal, lotWeights) : homes.map(() => 0);
  const methodParts = allocate(total - baseTotal, weights);

  const lotSum = lotWeights.reduce((a, b) => a + b, 0) || 1;
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const blended = homes.map((_, i) => base * (lotWeights[i] / lotSum) + (1 - base) * (weights[i] / weightSum));
  const useWord = settings.method === "frontage" ? "by frontage" : settings.method === "distance" ? "by distance" : "by use";

  const lines: ShareLine[] = homes.map((h, i) => ({
    homeId: h.id,
    label: h.label,
    amount: baseParts[i] + methodParts[i],
    pct: blended[i] * 100,
    reason:
      base > 0
        ? `Base share ${money(baseParts[i])} (${Math.round(base * 100)}% of the total, split evenly) plus ${money(methodParts[i])} ${useWord}. ${reasons[i]}`
        : reasons[i],
  }));

  return { ok: true, total, lines, problems, stretches };
}

/** Breaks the road at each driveway. Each stretch lists the homes at or beyond its far end. */
export function buildStretches(homes: SplitHome[]): Stretch[] {
  const points = [...new Set(homes.map((h) => h.distanceFt ?? 0).filter((d) => d > 0))].sort((a, b) => a - b);
  const out: Stretch[] = [];
  let prev = 0;
  for (const d of points) {
    out.push({ fromFt: prev, toFt: d, homeIds: homes.filter((h) => (h.distanceFt ?? 0) >= d).map((h) => h.id) });
    prev = d;
  }
  return out;
}

function segmentReason(h: SplitHome, stretches: Stretch[], vw: number): string {
  const d = h.distanceFt ?? 0;
  if (d === 0) return "Driveway is at the entrance, so this home uses none of the shared road.";
  const used = stretches.filter((s) => s.homeIds.includes(h.id));
  const first = used[0];
  const last = used[used.length - 1];
  let text = `Drives the first ${ft(d)}.`;
  if (first && last && first !== last) {
    text += ` The first stretch is shared by ${first.homeIds.length} homes; the last stretch to this driveway by ${last.homeIds.length}.`;
  } else if (first) {
    text += ` That stretch is shared by ${first.homeIds.length} home${first.homeIds.length === 1 ? "" : "s"}.`;
  }
  if (h.vacant && vw !== 1) text += ` Counted at ${Math.round(vw * 100)}% because the lot is vacant.`;
  return text;
}

/** One-line plain explanation used on bills and letters. */
export function methodSentence(settings: SplitSettings): string {
  let text = METHOD_INFO[settings.method].short;
  if (usesBase(settings)) text = `${settings.basePct}% of the total is split evenly; the rest ${METHOD_INFO[settings.method].name.toLowerCase()}.`;
  if (settings.vacantWeight < 1) text += ` Vacant lots pay ${Math.round(settings.vacantWeight * 100)}% of a share.`;
  return text;
}

export function usesBase(settings: SplitSettings): boolean {
  return (settings.method === "frontage" || settings.method === "distance" || settings.method === "segment") && settings.basePct > 0;
}

