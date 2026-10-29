"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createRoad } from "@/lib/client/backend";
import { listRoads, removeEntry, setActiveId } from "@/lib/client/registry";
import { buildDemoRoad } from "@/lib/seed";
import { LogoMark } from "./logo";
import { ButtonLink, Callout } from "./ui";

/** Builds a fresh copy of the demo road for this visitor, so testers never collide. */
export function DemoLoader() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const existing = listRoads().find((r) => r.demo);
        if (existing && !new URLSearchParams(window.location.search).has("fresh")) {
          setActiveId(existing.id);
          router.replace("/app");
          return;
        }
        for (const old of listRoads().filter((r) => r.demo)) removeEntry(old.id);
        await createRoad(buildDemoRoad(new Date()), { demo: true });
        router.replace("/app?welcome=demo");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't build the sample road.");
      }
    })();
  }, [router]);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark className="h-14 w-14" />
      {error ? (
        <div className="max-w-md space-y-4">
          <Callout tone="danger" title="The demo didn't load">
            {error}
          </Callout>
          <ButtonLink href="/">Back to the home page</ButtonLink>
        </div>
      ) : (
        <>
          <p className="text-[1.3rem] font-bold">Building Birch Hollow Lane…</p>
          <p className="max-w-sm text-stone">Nine homes, a year and a half of dues, bills, votes and an agreement in progress.</p>
          <LoaderCircle className="h-8 w-8 animate-spin text-pine" aria-hidden />
        </>
      )}
    </main>
  );
}
