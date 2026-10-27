export interface ForecastDay {
  name: string;
  start: string;
  daytime: boolean;
  temp: number;
  short: string;
  detail: string;
  precip: number | null;
  /** Expected new snow in inches as a [low, high] range, or null if none mentioned. */
  snow: [number, number] | null;
}

const WORDS: Record<string, number> = { an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5 };

function num(s: string): number {
  const t = s.trim().toLowerCase();
  if (t in WORDS) return WORDS[t];
  return Number(t);
}

/**
 * Reads NWS wording such as "New snow accumulation of 2 to 4 inches possible",
 * "around an inch", "less than half an inch", "up to 6 inches".
 */
export function parseSnow(text: string): [number, number] | null {
  const t = text.toLowerCase();
  if (!/snow/.test(t)) return null;
  let m = t.match(/snow accumulation of (?:around )?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten) to (\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten) inch/);
  if (m) return [num(m[1]), num(m[2])];
  m = t.match(/snow accumulation of (?:around|up to|near) (\d+(?:\.\d+)?|an|one|two|three|four|five|six|seven|eight|nine|ten) inch/);
  if (m) return [num(m[1]) * 0.5, num(m[1])];
  if (/snow accumulation of less than (?:half )?(?:an|one) inch/.test(t)) return [0, /half/.test(t) ? 0.5 : 1];
  m = t.match(/snow accumulation of (\d+(?:\.\d+)?|an|one|two|three|four|five|six) inch/);
  if (m) return [num(m[1]), num(m[1])];
  if (/little or no snow accumulation/.test(t)) return [0, 0.5];
  return null;
}

export function snowText(range: [number, number]): string {
  const [lo, hi] = range;
  if (hi <= 1 && lo === 0) return hi <= 0.5 ? "under ½ inch of snow" : "under an inch of snow";
  if (lo === hi) return `about ${hi} inch${hi === 1 ? "" : "es"} of snow`;
  return `${lo}–${hi} inches of snow`;
}
