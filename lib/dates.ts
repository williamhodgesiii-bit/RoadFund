import type { ISODate, ISOTime } from "./types.ts";

const MS_DAY = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date for a Date (or now). */
export function isoDate(d: Date = new Date()): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateFromISO(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = dateFromISO(date);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Adds business days (Mon–Fri) to a timestamp. ACH settles on business days. */
export function addBusinessDays(at: ISOTime, days: number): ISOTime {
  const d = new Date(at);
  let left = days;
  while (left > 0) {
    d.setTime(d.getTime() + MS_DAY);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d.toISOString();
}

/** Whole days from a to b (b - a), by calendar date. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((dateFromISO(b).getTime() - dateFromISO(a).getTime()) / MS_DAY);
}

/**
 * A deadline date ends at midnight in the road's time zone. US time zones run
 * UTC-4 to UTC-10, so the following day at 10:00 UTC covers every US road.
 */
export function endOfDayUS(date: ISODate): ISOTime {
  return `${addDays(date, 1)}T10:00:00.000Z`;
}

export function yearOf(value: ISODate | ISOTime): number {
  return Number(value.slice(0, 4));
}

const fmtLong = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const fmtShort = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fmtShortYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function toDate(value: ISODate | ISOTime): Date {
  return value.length === 10 ? dateFromISO(value) : new Date(value);
}

/** May 1, 2026 */
export function fmtDate(value: ISODate | ISOTime): string {
  return fmtLong.format(toDate(value));
}

/** May 1 (adds the year when it isn't this year) */
export function fmtDay(value: ISODate | ISOTime, now: Date = new Date()): string {
  const d = toDate(value);
  return d.getFullYear() === now.getFullYear() ? fmtShort.format(d) : fmtShortYear.format(d);
}

export function fmtDateTime(value: ISOTime): string {
  const d = new Date(value);
  return `${fmtShortYear.format(d)}, ${fmtTime.format(d)}`;
}

