import { clientIp, json, limited, rateLimit } from "@/lib/server/http";

// OpenStreetMap Nominatim. Free; usage policy asks for a real User-Agent and light use.
// Called only when someone presses Search, never as-you-type.
const UA = "RoadFund/0.1 (private road dues app)";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 160);
  if (q.length < 3) return json({ results: [] });
  if (!(await rateLimit(`geo:${clientIp(req)}`, 20, 60_000))) return limited();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=us&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US" }, next: { revalidate: 86_400 } });
    if (!res.ok) return json({ results: [], error: "Address search is busy. Tap the map to place your road instead." });
    const data = (await res.json()) as { display_name: string; lat: string; lon: string; address?: { county?: string; state?: string; road?: string } }[];
    return json({
      results: data.map((r) => ({
        label: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
        county: r.address?.county?.replace(/ County$/, "") ?? "",
        state: r.address?.state ?? "",
        road: r.address?.road ?? "",
      })),
    });
  } catch {
    return json({ results: [], error: "Address search didn't answer. Tap the map to place your road instead." });
  }
}
