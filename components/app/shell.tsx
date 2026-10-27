"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { Banknote, ChevronDown, Eye, FileText, House, LoaderCircle, Map, Settings, Users } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { ButtonLink, Callout, cx } from "@/components/ui";
import { ApiError, loadRoad } from "@/lib/client/backend";
import { activeEntry, listRoads, setActiveId, type RoadEntry } from "@/lib/client/registry";
import { RoadProvider, useRoad } from "@/lib/client/road-context";
import type { Road } from "@/lib/types";

const TABS = [
  { href: "/app", label: "Home", icon: House, match: (p: string) => p === "/app" },
  { href: "/app/money", label: "Money", icon: Banknote, match: (p: string) => p.startsWith("/app/money") },
  { href: "/app/road", label: "Road", icon: Map, match: (p: string) => p.startsWith("/app/road") },
  { href: "/app/papers", label: "Votes & Papers", short: "Papers", icon: FileText, match: (p: string) => p.startsWith("/app/papers") },
  { href: "/app/neighbors", label: "Neighbors", icon: Users, match: (p: string) => p.startsWith("/app/neighbors") },
];

type Loaded = { key: string; entry: RoadEntry; road: Road } | { key: string; entry: RoadEntry; error: string };

// The active road lives in localStorage; "rf:switch-road" (same tab) and "storage" (other tabs) signal changes.
function subscribeActive(cb: () => void) {
  window.addEventListener("rf:switch-road", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("rf:switch-road", cb);
    window.removeEventListener("storage", cb);
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // null on the server, "" when this browser has no road yet, otherwise the active road id.
  const activeId = useSyncExternalStore(
    subscribeActive,
    () => activeEntry()?.id ?? "",
    () => null,
  );
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${activeId}:${attempt}`;

  useEffect(() => {
    if (!activeId || path === "/app/join") return;
    const entry = activeEntry();
    if (!entry) return;
    let live = true;
    loadRoad(entry)
      .then((road) => live && setLoaded({ key, entry, road }))
      .catch((e) => live && setLoaded({ key, entry, error: e instanceof ApiError ? e.message : "Couldn't load your road." }));
    return () => {
      live = false;
    };
    // Reload only when the active road (or a retry) changes, not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, path === "/app/join"]);

  if (path === "/app/join") return <>{children}</>;
  if (activeId === "") return <NoRoad />;
  const load = loaded && loaded.key === key ? loaded : null;
  if (!load) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-stone">
        <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden /> Loading your road…
      </div>
    );
  }
  if ("error" in load) {
    return (
      <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-4">
        <LogoMark className="h-12 w-12" />
        <Callout tone="danger" title={`Couldn't open ${load.entry.name}`}>
          {load.error}
        </Callout>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-pine px-5 py-3 font-semibold text-white" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
          <ButtonLink href="/app/settings#roads" variant="secondary">
            Switch roads
          </ButtonLink>
        </div>
      </main>
    );
  }
  return (
    <RoadProvider key={load.entry.id} entry={load.entry} initial={load.road}>
      <Chrome>{children}</Chrome>
    </RoadProvider>
  );
}

function Chrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { road, entry, saving } = useRoad();
  const me = road.homes.find((h) => h.id === road.captainHomeId);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_1fr] print:block">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-white md:flex">
        <Link href="/" className="flex items-center gap-2 px-5 pb-4 pt-5" aria-label="Road Fund home">
          <LogoMark className="h-8 w-8" />
          <span className="font-display text-[1.2rem] font-extrabold">Road Fund</span>
        </Link>
        <RoadSwitcher />
        <nav aria-label="Road sections" className="mt-3 flex-1 px-3">
          <ul className="space-y-1">
            {TABS.map((t) => {
              const on = t.match(path);
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={on ? "page" : undefined}
                    className={cx("flex items-center gap-3 rounded-xl px-3 py-3 font-semibold", on ? "bg-pine text-white" : "text-charcoal hover:bg-paper-2")}
                  >
                    <t.icon className="h-5 w-5" aria-hidden />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          {me && (
            <a href={`/n/${road.id}/${me.token}`} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-charcoal hover:bg-paper-2">
              <Eye className="h-5 w-5" aria-hidden /> See neighbor view
            </a>
          )}
          <Link
            href="/app/settings"
            className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold", path.startsWith("/app/settings") ? "bg-paper-2" : "hover:bg-paper-2")}
          >
            <Settings className="h-5 w-5" aria-hidden /> Settings
          </Link>
          <p className="px-3 pt-2 text-[0.8rem] text-stone">
            {entry.where === "cloud" ? "Saved to the cloud" : "Saved in this browser"} · test mode
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-line bg-white/95 px-3 backdrop-blur md:hidden">
          <Link href="/app" className="flex min-w-0 items-center gap-2" aria-label="Home">
            <LogoMark className="h-8 w-8 shrink-0" />
            <span className="truncate font-display text-[1.05rem] font-extrabold">{road.name}</span>
          </Link>
          <div className="flex items-center gap-1">
            {me && (
              <a href={`/n/${road.id}/${me.token}`} target="_blank" rel="noopener" className="rounded-lg p-2.5 text-stone hover:bg-paper-2" aria-label="See neighbor view">
                <Eye className="h-5 w-5" aria-hidden />
              </a>
            )}
            <Link href="/app/settings" className="rounded-lg p-2.5 text-stone hover:bg-paper-2" aria-label="Settings">
              <Settings className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </header>
        <div className="no-print border-b border-sign/50 bg-sign-50 px-4 py-1.5 text-center text-[0.85rem] text-sign-ink">
          Test mode: payments, bank connections and texts are simulated.
          {saving && <span className="ml-2 inline-flex items-center gap-1 font-semibold"><LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving</span>}
        </div>
        <main id="main" className="mx-auto max-w-5xl px-4 pb-32 pt-6 md:px-8 md:pb-16 md:pt-8 print:max-w-none print:p-0">
          <Suspense>{children}</Suspense>
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav aria-label="Road sections" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {TABS.map((t) => {
            const on = t.match(path);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={on ? "page" : undefined} className={cx("flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[0.75rem] font-semibold", on ? "text-pine" : "text-stone")}>
                  <span className={cx("rounded-full px-3 py-1", on && "bg-pine-50")}>
                    <t.icon className="h-6 w-6" aria-hidden />
                  </span>
                  {t.short ?? t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function RoadSwitcher() {
  const { road, entry } = useRoad();
  const [open, setOpen] = useState(false);
  const [roads, setRoads] = useState<RoadEntry[]>([]);
  return (
    <div className="relative px-3">
      <button
        onClick={() => {
          setRoads(listRoads());
          setOpen((o) => !o);
        }} className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-left" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block truncate font-bold">{road.name}</span>
          <span className="block truncate text-[0.82rem] text-stone">
            {road.homes.length} homes · {road.code}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone" aria-hidden />
      </button>
      {open && (
        <div className="absolute inset-x-3 top-full z-50 mt-1 rounded-xl border border-line bg-white p-1.5 shadow-lift">
          {roads.map((r) => (
            <button
              key={r.id}
              className={cx("block w-full rounded-lg px-3 py-2 text-left hover:bg-paper-2", r.id === entry.id && "font-bold")}
              onClick={() => {
                setActiveId(r.id);
                setOpen(false);
                window.dispatchEvent(new Event("rf:switch-road"));
              }}
            >
              {r.name}
              {r.demo && <span className="ml-1.5 text-[0.8rem] font-normal text-stone">demo</span>}
            </button>
          ))}
          <Link href="/start" className="block rounded-lg px-3 py-2 font-semibold text-pine hover:bg-paper-2">
            + Set up another road
          </Link>
        </div>
      )}
    </div>
  );
}

function NoRoad() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <LogoMark className="h-14 w-14" />
      <h1 className="mt-5 text-[2rem] font-black">No road in this browser yet</h1>
      <p className="mt-2 text-[1.05rem] text-stone">Set up your road, or try every feature on a demo road with nine homes and a year and a half of history.</p>
      <div className="mt-6 grid gap-3">
        <ButtonLink href="/start" size="lg">
          Set up your road
        </ButtonLink>
        <ButtonLink href="/demo" size="lg" variant="secondary">
          Open the demo road
        </ButtonLink>
      </div>
      <p className="mt-6 text-stone">
        Captain on another device? Open the captain link you saved from Settings on that device, or ask the current captain to hand off the role.
      </p>
    </main>
  );
}
