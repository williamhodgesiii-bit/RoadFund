import { json } from "@/lib/server/http";
import { fetchForecast } from "@/lib/server/weather";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const forecast = await fetchForecast(Number(sp.get("lat")), Number(sp.get("lng")));
  return json(forecast, 200, forecast.available ? { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } : {});
}
