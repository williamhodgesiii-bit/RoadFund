"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { ButtonLink, Callout } from "@/components/ui";
import { loadRoad } from "@/lib/client/backend";
import { saveEntry, setActiveId, type RoadEntry } from "@/lib/client/registry";
import { useHash, useHydrated } from "@/lib/client/use-browser";

/** Opens a cloud road on a new device from a captain link: /app/join#road=ID&key=KEY */
export default function JoinPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const params = new URLSearchParams(useHash());
  const id = params.get("road");
  const key = params.get("key");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !key) return;
    const entry: RoadEntry = { id, name: "Your road", where: "cloud", key, addedAt: new Date().toISOString(), demo: false };
    loadRoad(entry).then(
      (road) => {
        saveEntry({ ...entry, name: road.name });
        setActiveId(id);
        window.dispatchEvent(new Event("rf:switch-road"));
        router.replace("/app");
      },
      (e) => setError(e instanceof Error ? e.message : "Couldn't open the road."),
    );
  }, [id, key, router]);

  const shown = error ?? (hydrated && (!id || !key) ? "This captain link is incomplete. Copy it again from Settings on the device you set the road up on." : null);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <LogoMark className="h-12 w-12" />
      {shown ? (
        <>
          <Callout tone="danger">{shown}</Callout>
          <ButtonLink href="/app">Go to my roads</ButtonLink>
        </>
      ) : (
        <p className="flex items-center gap-2 text-stone">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> Opening your road…
        </p>
      )}
    </main>
  );
}
