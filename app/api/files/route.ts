import { CommandError } from "@/lib/commands";
import { errorResponse, json, readJSON } from "@/lib/server/http";
import { kvEnabled } from "@/lib/server/kv";
import { checkCaptain, putFile } from "@/lib/server/store";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BASE64 = 1_000_000; // about 750 KB of file

export async function POST(req: Request) {
  try {
    if (!kvEnabled) throw new CommandError("Cloud storage is off.", 501);
    const body = await readJSON<{ roadId: string; id: string; mime: string; data: string }>(req, MAX_BASE64 + 2_000);
    if (!(await checkCaptain(body.roadId, req.headers.get("x-road-key")))) throw new CommandError("Not allowed.", 401);
    if (!/^file_[a-z0-9]{20,}$/.test(body.id)) throw new CommandError("Invalid file id.");
    if (!ALLOWED.has(body.mime)) throw new CommandError("Upload a photo (JPG, PNG, WebP) or a PDF.");
    if (body.data.length > MAX_BASE64) throw new CommandError("Files must be under 750 KB. Photos are shrunk automatically; large PDFs need to be compressed first.", 413);
    await putFile(body.id, { roadId: body.roadId, mime: body.mime, data: body.data });
    return json({ ok: true }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
