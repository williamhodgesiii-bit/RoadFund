import type { Metadata } from "next";
import { NeighborApp } from "@/components/neighbor/neighbor-app";

export const metadata: Metadata = { title: "Your road", robots: { index: false, follow: false } };

export default async function NeighborPage({ params }: { params: Promise<{ roadId: string; token: string }> }) {
  const { roadId, token } = await params;
  return <NeighborApp roadId={roadId} token={token} />;
}
