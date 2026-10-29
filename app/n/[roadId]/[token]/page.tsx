import type { Metadata } from "next";
import { NeighborApp } from "@/components/neighbor/neighbor-app";
import { neighborView, type NeighborView } from "@/lib/neighbor";
import { kvEnabled } from "@/lib/server/kv";
import { deploymentStatus } from "@/lib/server/status";
import { loadRoad } from "@/lib/server/store";

export const metadata: Metadata = { title: "Your road", robots: { index: false, follow: false } };

export default async function NeighborPage({
  params,
  searchParams,
}: {
  params: Promise<{ roadId: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { roadId, token } = await params;
  const returning = typeof (await searchParams).paid === "string";
  // Cloud roads render on the server, so the bill shows in the first response on a weak signal.
  // Roads kept in the captain's browser can only be read there, so those load in the browser.
  let initial: NeighborView | null = null;
  if (kvEnabled) {
    const found = await loadRoad(roadId).catch(() => null);
    const home = found?.road.homes.find((h) => h.token === token);
    if (found && home) initial = neighborView(found.road, home.id, new Date());
  }
  return <NeighborApp roadId={roadId} token={token} initial={initial} initialStatus={kvEnabled ? deploymentStatus() : null} returning={returning} />;
}
