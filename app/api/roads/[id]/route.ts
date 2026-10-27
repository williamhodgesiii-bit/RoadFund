import { CommandError, isCommand, type Command } from "@/lib/commands";
import { captainHome, displayName } from "@/lib/selectors";
import { errorResponse, json, readJSON } from "@/lib/server/http";
import { checkCaptain, deleteRoad, loadRoad, mutate } from "@/lib/server/store";

type Params = { params: Promise<{ id: string }> };

async function authorize(req: Request, id: string) {
  if (!(await checkCaptain(id, req.headers.get("x-road-key")))) throw new CommandError("This captain link isn't valid for this road.", 401);
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await authorize(req, id);
    const found = await loadRoad(id);
    if (!found) throw new CommandError("Road not found.", 404);
    return json({ road: found.road });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await authorize(req, id);
    const { commands } = await readJSON<{ commands: Command[] }>(req);
    if (!Array.isArray(commands) || commands.length === 0 || commands.length > 60 || !commands.every(isCommand)) {
      throw new CommandError("That change wasn't valid.");
    }
    const road = await mutate(id, (current) => {
      const cap = captainHome(current);
      return {
        commands,
        ctx: { at: new Date().toISOString(), actor: { kind: "captain", homeId: cap?.id ?? null, name: cap ? displayName(cap) : "Road captain" } },
      };
    });
    return json({ road });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await authorize(req, id);
    const found = await loadRoad(id);
    if (found) await deleteRoad(id, found.road);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
