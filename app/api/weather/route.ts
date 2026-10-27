import { json } from "@/lib/server/http";
import { parseSnow, type ForecastDay } from "@/lib/weather";

// National Weather Service API: free, no key, US only. Requires a User-Agent.
const UA = "RoadFund/0.1 (private road dues app; contact via site)";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ available: false, reason: "No location for this road yet." });
  }
  try {
    const point = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
      headers: { "User-Agent": UA, Accept: "application/geo+json" },
      next: { revalidate: 86_400 },
    });
    if (!point.ok) return json({ available: false, reason: "Forecasts are available for US locations only." });
    const meta = (await point.json()) as { properties?: { forecast?: string; relativeLocation?: { properties?: { city?: string; state?: string } } } };
    const forecastUrl = meta.properties?.forecast;
    if (!forecastUrl) return json({ available: false, reason: "No forecast for this spot." });
    const res = await fetch(forecastUrl, { headers: { "User-Agent": UA, Accept: "application/geo+json" }, next: { revalidate: 1800 } });
    if (!res.ok) return json({ available: false, reason: "The weather service didn't answer. Try again later." });
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
    return json(
      { available: true, place: loc ? `${loc.city}, ${loc.state}` : null, days },
      200,
      { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    );
  } catch {
    return json({ available: false, reason: "The weather service didn't answer. Try again later." });
  }
}
