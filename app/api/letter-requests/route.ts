import { after } from "next/server";
import { CommandError } from "@/lib/commands";
import { normalizeCode, uid } from "@/lib/ids";
import { notifyLetterRequest } from "@/lib/server/effects";
import { clientIp, errorResponse, json, limited, rateLimit, readJSON } from "@/lib/server/http";
import { kvEnabled } from "@/lib/server/kv";
import { validEmail } from "@/lib/server/notify";
import { loadRoad, mutate, roadIdByCode } from "@/lib/server/store";
import { letterCheckout, usesStripe } from "@/lib/server/stripe";
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
    if (!(await rateLimit(`lreq:${clientIp(req)}`, 10, 60 * 60_000))) return limited();
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
    const propertyAddress = String(body.propertyAddress ?? "").trim().slice(0, 160);
    const closingDate = /^\d{4}-\d{2}-\d{2}$/.test(body.closingDate ?? "") ? body.closingDate : null;
    const note = String(body.note ?? "").slice(0, 400);
    if (!requester.name.trim() || !validEmail(requester.email)) throw new CommandError("Add your name and a valid email.");
    if (!propertyAddress) throw new CommandError("Add the property address.");

    const found = await loadRoad(id);
    if (!found) throw new CommandError("We couldn't find a road with that code.", 404);
    const origin = new URL(req.url).origin;

    // With Stripe on, the requester pays the $75 fee first. The request is
    // created when the payment completes (return page or webhook).
    if (usesStripe(found.road)) {
      if (found.road.letterRequests.filter((x) => x.status === "new").length >= 20) {
        throw new CommandError("This road has too many open letter requests. Contact the road captain directly.", 429);
      }
      const homeId = body.homeId && found.road.homes.some((h) => h.id === body.homeId) ? body.homeId : "";
      const url = await letterCheckout({
        roadId: id,
        roadCode: code,
        origin,
        requester,
        fields: {
          homeId,
          propertyAddress,
          closingDate: closingDate ?? "",
          note,
          requesterName: requester.name,
          requesterCompany: requester.company,
          requesterEmail: requester.email,
          requesterPhone: requester.phone,
          role: requester.role,
        },
      });
      return json({ url });
    }

    const at = new Date().toISOString();
    const requestId = uid("lreq");
    const road = await mutate(id, (road) => {
      const homeId = body.homeId && road.homes.some((h) => h.id === body.homeId) ? body.homeId : null;
      const request: LetterRequest = { id: requestId, createdAt: at, homeId, propertyAddress, requester, closingDate, status: "new", letterId: null, note };
      return { commands: [{ type: "letterRequest.create", request }], ctx: { at, actor: { kind: "public", homeId: null, name: requester.company || requester.name } } };
    });
    after(() => notifyLetterRequest(road, requestId, origin));
    return json({ ok: true }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
