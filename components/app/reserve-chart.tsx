"use client";

import { useState } from "react";
import { money, moneyShort } from "@/lib/money";
import type { ReserveYear } from "@/lib/selectors";

/**
 * Year-end savings balance, one column per year. One series at a time, so the
 * only color meaning is status: pine when the fund is above $0, brick (with a
 * "Short" label) when big repairs would overdraw it.
 */
export function ReserveChart({ rows }: { rows: ReserveYear[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 260;
  const pad = { l: 56, r: 12, t: 16, b: 34 };
  const values = rows.map((r) => r.end);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const step = niceStep((max - min) / 4 || 100_000);
  const top = Math.ceil(max / step) * step || step;
  const bottom = Math.floor(min / step) * step;
  const y = (v: number) => pad.t + ((top - v) / (top - bottom)) * (H - pad.t - pad.b);
  const band = (W - pad.l - pad.r) / rows.length;
  const barW = Math.min(24, band * 0.5);
  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1; v += step) ticks.push(v);

  const active = hover !== null ? rows[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Savings balance at the end of each year">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#5C6159" : "#EEEBE3"} strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#5C6159">
              {compact(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = pad.l + band * i + band / 2;
          const v = r.end;
          const y0 = y(0);
          const y1 = y(v);
          const h = Math.max(1, Math.abs(y1 - y0));
          const neg = v < 0;
          const rr = Math.min(4, h);
          const x = cx - barW / 2;
          // 4px rounded data end; square at the zero baseline.
          const d = neg
            ? `M${x},${y0} h${barW} v${h - rr} q0,${rr} -${rr},${rr} h-${barW - 2 * rr} q-${rr},0 -${rr},-${rr} Z`
            : `M${x},${y0} v-${h - rr} q0,-${rr} ${rr},-${rr} h${barW - 2 * rr} q${rr},0 ${rr},${rr} v${h - rr} Z`;
          return (
            <g key={r.year}>
              <path d={d} fill={neg ? "#B3261E" : "#1F5E3B"} opacity={hover === null || hover === i ? 1 : 0.55} />
              {r.spend.length > 0 && <circle cx={cx} cy={H - pad.b + 22} r={4} fill="#F2A900" stroke="#fff" strokeWidth={2} />}
              <text x={cx} y={H - pad.b + 14} textAnchor="middle" fontSize="12" fill="#5C6159">
                {String(r.year).slice(2) === String(rows[0].year).slice(2) || i % 2 === 0 ? r.year : `’${String(r.year).slice(2)}`}
              </text>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t - pad.b + 30} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)} />
            </g>
          );
        })}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-60 rounded-xl border border-line bg-white p-3 text-[0.88rem] shadow-lift"
          style={{ left: `clamp(0px, calc(${((pad.l + band * (hover! + 0.5)) / W) * 100}% - 7.5rem), calc(100% - 15rem))` }}
        >
          <p className="font-bold">{active.year}</p>
          <p className="tnum">
            Starts {money(active.start)}, adds {money(active.contribution)}
          </p>
          {active.spend.map((s) => (
            <p key={s.name} className="tnum">
              Spends {money(s.cost)} on {s.name.toLowerCase()}
            </p>
          ))}
          <p className={`tnum mt-1 font-bold ${active.end < 0 ? "text-brick" : ""}`}>
            Ends {money(active.end)}
            {active.end < 0 && " · Short"}
          </p>
        </div>
      )}
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.85rem] text-stone">
        <span>Bars: savings left at the end of each year.</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-sign" aria-hidden /> big repair that year
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-brick" aria-hidden /> short: not enough saved
        </span>
      </p>
    </div>
  );
}

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}

function compact(cents: number): string {
  const d = cents / 100;
  if (Math.abs(d) >= 1000) return `${d < 0 ? "−" : ""}$${Math.abs(d / 1000).toFixed(Math.abs(d) % 1000 === 0 ? 0 : 1)}K`;
  return moneyShort(cents).replace("-", "−");
}
