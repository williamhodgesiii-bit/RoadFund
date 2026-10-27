import { kvEnabled } from "@/lib/server/kv";
import { getFile } from "@/lib/server/store";

type Params = { params: Promise<{ id: string }> };

/** Files are addressed by an unguessable id (100+ random bits), like a private share link. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  if (!kvEnabled || !/^file_[a-z0-9]{20,}$/.test(id)) return new Response("Not found", { status: 404 });
  const file = await getFile(id);
  if (!file) return new Response("Not found", { status: 404 });
  const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex",
      "Content-Disposition": file.mime === "application/pdf" ? "inline" : "inline",
    },
  });
}
