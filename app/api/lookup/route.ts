import { normalizeCode } from "@/lib/ids";
import { clientIp, errorResponse, json, limited, rateLimit } from "@/lib/server/http";
import { kvEnabled } from "@/lib/server/kv";
import { loadRoad, roadIdByCode } from "@/lib/server/store";
import { usesStripe } from "@/lib/server/stripe";

/** Lets a title company confirm a road by its code and pick the property. Addresses only; no owner names. */
export async function GET(req: Request) {
  try {
    if (!kvEnabled) return json({ road: null, cloud: false });
    if (!(await rateLimit(`lookup:${clientIp(req)}`, 30, 60_000))) return limited();
    const raw = normalizeCode(new URL(req.url).searchParams.get("code") ?? "");
    const code = raw.startsWith("RF") ? `RF-${raw.slice(2)}` : `RF-${raw}`;
    const id = await roadIdByCode(code);
    const found = id ? await loadRoad(id) : null;
    if (!found) return json({ road: null, cloud: true });
    const r = found.road;
    return json({
      cloud: true,
      road: {
        code: r.code,
        name: r.name,
        county: r.county,
        state: r.state,
        homes: r.homes.map((h) => ({ id: h.id, label: h.label, address: h.address })),
        payFirst: usesStripe(r),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
