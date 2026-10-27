import { CommandError } from "@/lib/commands";
import { kvEnabled } from "@/lib/server/kv";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { createRoad } from "@/lib/server/store";
import type { Road } from "@/lib/types";

export async function POST(req: Request) {
  try {
    if (!kvEnabled) throw new CommandError("Cloud storage is off.", 501);
    if (!rateLimit(`create:${clientIp(req)}`, 10, 60 * 60_000)) return limited();
    const { road } = await readJSON<{ road: Road }>(req);
    if (!road || road.schema !== 1 || !Array.isArray(road.homes)) throw new CommandError("That road wasn't valid.");
    const result = await createRoad({ ...road, updatedAt: new Date().toISOString() });
    return json(result, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
