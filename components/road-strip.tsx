"use client";

import { useEffect, useRef, useState } from "react";
import type { Stretch } from "@/lib/split";

interface StripHome {
  id: string;
  label: string;
  distanceFt: number | null;
}

/**
 * The road drawn as a straight strip from the main road to the far end.
 * Each stretch is shaded by how many homes share it; the selected home's
 * stretches are highlighted so a neighbor can see exactly what they pay for.
 * Drawn at the container's real pixel width so labels stay readable on phones.
 */
export function RoadStrip({
  homes,
  stretches,
  lengthFt,
  selectedId,
  onSelect,
}: {
  homes: StripHome[];
  stretches: Stretch[];
  lengthFt?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = homes.filter((h) => (h.distanceFt ?? 0) > 0);
  const far = Math.max(lengthFt ?? 0, ...placed.map((h) => h.distanceFt ?? 0), 1);
  const narrow = W < 480;
  const left = narrow ? 30 : 46;
  const right = 14;
  const x = (ft: number) => left + (ft / far) * (W - left - right);
  const maxUsers = Math.max(1, ...stretches.map((s) => s.homeIds.length));
  const sorted = [...placed].sort((a, b) => (a.distanceFt ?? 0) - (b.distanceFt ?? 0));
  const selected = homes.find((h) => h.id === selectedId);
  const font = narrow ? 12 : 13;
  const H = 104;

  return (
    <figure className="w-full">
      <div ref={box} className="w-full">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label={`Road diagram: ${sorted.length} driveways along ${Math.round(far).toLocaleString()} feet`}>
          {/* main road */}
          <rect x="0" y="26" width={left - 6} height="34" rx="3" fill="#5C6159" />
          <text x={(left - 6) / 2} y="47" textAnchor="middle" fontSize={narrow ? 9 : 11} fill="#fff" fontWeight="700">
            {narrow ? "Rd" : "Main"}
          </text>
          <rect x={left} y="34" width={W - left - right} height="18" rx="4" fill="#EEEBE3" />
          {stretches.map((s, i) => {
            const share = s.homeIds.length / maxUsers;
            const mine = !!selectedId && s.homeIds.includes(selectedId);
            const fill = selectedId ? (mine ? "#1F5E3B" : "#DCD8CE") : `rgba(31,94,59,${0.25 + 0.65 * share})`;
            const w = x(s.toFt) - x(s.fromFt);
            return (
              <g key={i}>
                <rect x={x(s.fromFt) + (i === 0 ? 0 : 1)} y="34" width={Math.max(1, w - 2)} height="18" rx={2} fill={fill}>
                  <title>{`${Math.round(s.fromFt)}–${Math.round(s.toFt)} ft: shared by ${s.homeIds.length} home${s.homeIds.length === 1 ? "" : "s"}`}</title>
                </rect>
                {w > 22 && (
                  <text x={(x(s.fromFt) + x(s.toFt)) / 2} y="27" textAnchor="middle" fontSize={font - 1} fill="#5C6159">
                    {s.homeIds.length}
                  </text>
                )}
              </g>
            );
          })}
          {sorted.map((h, i) => {
            const hx = x(h.distanceFt ?? 0);
            const on = h.id === selectedId;
            const prev = sorted[i - 1];
            const crowded = !!prev && hx - x(prev.distanceFt ?? 0) < (narrow ? 22 : 30);
            const low = crowded && i % 2 === 1;
            const short = h.label.replace(/^Lot\s*/i, "");
            return (
              <g key={h.id} onClick={onSelect ? () => onSelect(h.id) : undefined} style={{ cursor: onSelect ? "pointer" : undefined }}>
                <line x1={hx} x2={hx} y1="52" y2="66" stroke={on ? "#1F5E3B" : "#5C6159"} strokeWidth={on ? 3 : 2} />
                <circle cx={hx} cy="70" r={on ? 6.5 : 4.5} fill={on ? "#F2A900" : "#1E2320"} stroke="#fff" strokeWidth="2" />
                <text x={hx} y={low ? 100 : 89} textAnchor="middle" fontSize={font} fontWeight={on ? 800 : 600} fill="#1E2320">
                  {short.length > 4 ? short.slice(0, 4) : short}
                </text>
                {onSelect && <rect x={hx - 14} y="48" width="28" height="56" fill="transparent" />}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[0.85rem] text-stone">
        <span>Numbers above the road: homes sharing each stretch.</span>
        {selected ? (
          <span>
            <span className="inline-block h-2.5 w-5 translate-y-[1px] rounded-sm bg-pine" aria-hidden /> What {selected.label} drives ({Math.round(selected.distanceFt ?? 0).toLocaleString()} ft)
          </span>
        ) : (
          <span>Darker: shared by more homes.</span>
        )}
      </figcaption>
    </figure>
  );
}
