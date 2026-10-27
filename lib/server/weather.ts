import "server-only";

import { parseSnow, type ForecastDay } from "../weather.ts";

// National Weather Service API: free, no key, US only. Requires a User-Agent.
const UA = "RoadFund/1.0 (private road dues app)";
const BASE = process.env.NWS_API_BASE ?? "https://api.weather.gov";

export type Forecast = { available: true; place: string | null; days: ForecastDay[] } | { available: false; reason: string };

export async function fetchForecast(lat: number, lng: number): Promise<Forecast> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { available: false, reason: "No location for this road yet." };
  }
  try {
    const point = await fetch(`${BASE}/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
      headers: { "User-Agent": UA, Accept: "application/geo+json" },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!point.ok) return { available: false, reason: "Forecasts are available for US locations only." };
    const meta = (await point.json()) as { properties?: { forecast?: string; relativeLocation?: { properties?: { city?: string; state?: string } } } };
    const forecastUrl = meta.properties?.forecast;
    if (!forecastUrl) return { available: false, reason: "No forecast for this spot." };
    const res = await fetch(forecastUrl, { headers: { "User-Agent": UA, Accept: "application/geo+json" }, next: { revalidate: 1800 }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return { available: false, reason: "The weather service didn't answer. Try again later." };
    const data = (await res.json()) as {
      properties?: { periods?: { name: string; startTime: string; isDaytime: boolean; temperature: number; shortForecast: string; detailedForecast: string; probabilityOfPrecipitation?: { value: number | null } }[] };
    };
    const days: ForecastDay[] = (data.properties?.periods ?? []).slice(0, 14).map((p) => ({
      name: p.name,
      start: p.startTime,
      daytime: p.isDaytime,
      temp: p.temperature,
      short: p.shortForecast,
      detail: p.detailedForecast,
      precip: p.probabilityOfPrecipitation?.value ?? null,
      snow: parseSnow(p.detailedForecast),
    }));
    const loc = meta.properties?.relativeLocation?.properties;
    return { available: true, place: loc ? `${loc.city}, ${loc.state}` : null, days };
  } catch {
    return { available: false, reason: "The weather service didn't answer. Try again later." };
  }
}
