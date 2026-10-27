import { normalizeCode } from "@/lib/ids";
import { publicLetter } from "@/lib/letter";
import { clientIp, errorResponse, json, limited, rateLimit } from "@/lib/server/http";
import { kvEnabled } from "@/lib/server/kv";
import { loadRoad, roadIdByLetter } from "@/lib/server/store";

type Params = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    if (!kvEnabled) return json({ letter: null, cloud: false });
    if (!rateLimit(`verify:${clientIp(req)}`, 30, 60_000)) return limited();
    const raw = normalizeCode((await params).code);
    if (raw.length !== 8) return json({ letter: null, cloud: true });
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    const id = await roadIdByLetter(code);
    const found = id ? await loadRoad(id) : null;
    const letter = found?.road.letters.find((l) => l.code === code);
    return json({ letter: letter ? publicLetter(letter) : null, cloud: true });
  } catch (err) {
    return errorResponse(err);
  }
}
