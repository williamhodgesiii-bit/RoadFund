import { json } from "@/lib/server/http";
import { deploymentStatus } from "@/lib/server/status";

export async function GET() {
  return json(deploymentStatus());
}
