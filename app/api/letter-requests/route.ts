import { CommandError } from "@/lib/commands";
import { normalizeCode, uid } from "@/lib/ids";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { kvEnabled } from "@/lib/server/kv";
import { mutate, roadIdByCode } from "@/lib/server/store";
import type { LetterRequest, Requester } from "@/lib/types";

interface Body {
  code: string;
  homeId: string | null;
  propertyAddress: string;
  closingDate: string | null;
  note: string;
  requester: Requester;
}

const ROLES = new Set(["title", "lender", "attorney", "agent", "seller", "buyer", "other"]);

export async function POST(req: Request) {
  try {
    if (!kvEnabled) throw new CommandError("Cloud storage is off.", 501);
    if (!rateLimit(`lreq:${clientIp(req)}`, 10, 60 * 60_000)) return limited();
    const body = await readJSON<Body>(req, 20_000);
    const raw = normalizeCode(body.code ?? "");
    const code = raw.startsWith("RF") ? `RF-${raw.slice(2)}` : `RF-${raw}`;
    const id = await roadIdByCode(code);
    if (!id) throw new CommandError("We couldn't find a road with that code.", 404);
    const r = body.requester ?? ({} as Requester);
    const requester: Requester = {
      name: String(r.name ?? "").slice(0, 80),
      company: String(r.company ?? "").slice(0, 120),
      email: String(r.email ?? "").slice(0, 120),
      phone: String(r.phone ?? "").slice(0, 40),
      role: ROLES.has(r.role) ? r.role : "other",
    };
    const at = new Date().toISOString();
    await mutate(id, (road) => {
      const homeId = body.homeId && road.homes.some((h) => h.id === body.homeId) ? body.homeId : null;
      const request: LetterRequest = {
        id: uid("lreq"),
        createdAt: at,
        homeId,
        propertyAddress: String(body.propertyAddress ?? "").slice(0, 160),
        requester,
        closingDate: /^\d{4}-\d{2}-\d{2}$/.test(body.closingDate ?? "") ? body.closingDate : null,
        status: "new",
        letterId: null,
        note: String(body.note ?? "").slice(0, 500),
      };
      return { commands: [{ type: "letterRequest.create", request }], ctx: { at, actor: { kind: "public", homeId: null, name: requester.company || requester.name } } };
    });
    return json({ ok: true }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
