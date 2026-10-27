import { kvEnabled } from "@/lib/server/kv";
import { aiEnabled } from "@/lib/server/ai";
import { json } from "@/lib/server/http";

export async function GET() {
  return json({ cloud: kvEnabled, ai: aiEnabled });
}
