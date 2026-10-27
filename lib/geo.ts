import type { LatLng } from "./types.ts";

const EARTH_RADIUS_FT = 20_902_231;
const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceFt(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_FT * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthFt(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceFt(path[i - 1], path[i]);
  return total;
}

/** Local flat projection in feet around a reference point. Accurate to well under 1% for a few miles. */
function project(p: LatLng, ref: LatLng): { x: number; y: number } {
  const ftPerDegLat = (Math.PI / 180) * EARTH_RADIUS_FT;
  return { x: (p.lng - ref.lng) * ftPerDegLat * Math.cos(toRad(ref.lat)), y: (p.lat - ref.lat) * ftPerDegLat };
}

/**
 * Snaps a point to the road and returns how far along the road it is (from the
 * first point, the entrance) and how far off the road it sits.
 */
export function locateOnPath(path: LatLng[], point: LatLng): { alongFt: number; offsetFt: number } | null {
  if (path.length < 2) return null;
  const ref = path[0];
  const p = project(point, ref);
  let best = { alongFt: 0, offsetFt: Infinity };
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const a = project(path[i - 1], ref);
    const b = project(path[i], ref);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const off = Math.hypot(p.x - cx, p.y - cy);
    const segLen = Math.sqrt(len2);
    if (off < best.offsetFt) best = { alongFt: walked + t * segLen, offsetFt: off };
    walked += segLen;
  }
  return best;
}

/** The point at a given distance along the road. */
export function pointAlong(path: LatLng[], alongFt: number): LatLng | null {
  if (path.length === 0) return null;
  if (path.length === 1 || alongFt <= 0) return path[0];
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceFt(path[i - 1], path[i]);
    if (walked + seg >= alongFt) {
      const t = seg === 0 ? 0 : (alongFt - walked) / seg;
      return { lat: path[i - 1].lat + t * (path[i].lat - path[i - 1].lat), lng: path[i - 1].lng + t * (path[i].lng - path[i - 1].lng) };
    }
    walked += seg;
  }
  return path[path.length - 1];
}

export function center(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const lng = points.reduce((a, p) => a + p.lng, 0) / points.length;
  return { lat, lng };
}

export function fmtFeet(ft: number): string {
  if (ft >= 5280 * 0.5) return `${(ft / 5280).toFixed(2)} mi`;
  return `${Math.round(ft).toLocaleString("en-US")} ft`;
}
