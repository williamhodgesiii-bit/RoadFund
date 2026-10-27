"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { applyAll, CommandError, type Command } from "../commands";
import type { Road } from "../types";
import { captainCtx, getStatus, loadRoad, sendCommands, type Status } from "./backend";
import { renameEntry, type RoadEntry } from "./registry";
import { useToast } from "@/components/toast";

interface RoadState {
  road: Road;
  entry: RoadEntry;
  status: Status;
  /** A clock that ticks every minute so "processing" and "late" stay current. */
  now: Date;
  /** Apply changes. Shows a toast on failure and returns false. */
  dispatch: (commands: Command | Command[], success?: string) => Promise<boolean>;
  saving: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<RoadState | null>(null);

export function useRoad(): RoadState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoad must be used inside RoadProvider");
  return v;
}

export function RoadProvider({ entry, initial, children }: { entry: RoadEntry; initial: Road; children: React.ReactNode }) {
  const [road, setRoad] = useState(initial);
  const [status, setStatus] = useState<Status>({ cloud: entry.where === "cloud", ai: false });
  const [now, setNow] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const latest = useRef(road);
  useEffect(() => {
    latest.current = road;
  }, [road]);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    getStatus().then(setStatus);
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const fresh = await loadRoad(entry);
      setRoad(fresh);
    } catch {
      // Keep showing what we have; the next action will surface any error.
    }
  }, [entry]);

  // Local mode: another tab (e.g. a neighbor link opened for testing) may change the road.
  // Cloud mode: neighbors pay from their phones, so refresh when the captain comes back to the tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `rf:road:${entry.id}` && e.newValue) setRoad(JSON.parse(e.newValue) as Road);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        if (entry.where === "cloud") refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [entry, refresh]);

  useEffect(() => {
    renameEntry(entry.id, road.name);
  }, [entry.id, road.name]);

  const dispatch = useCallback(
    async (input: Command | Command[], success?: string): Promise<boolean> => {
      const commands = Array.isArray(input) ? input : [input];
      const before = latest.current;
      // Run the reducer here first: instant feedback, and rule errors show without a round trip.
      try {
        const optimistic = applyAll(before, commands, captainCtx(before));
        setRoad(optimistic);
      } catch (e) {
        toast(e instanceof CommandError ? e.message : "That change didn't work.", "error");
        return false;
      }
      setSaving(true);
      let ok = true;
      // Serialize saves so two quick taps can't race.
      const run = queue.current.then(async () => {
        try {
          const saved = await sendCommands(entry, commands);
          setRoad(saved);
          if (success) toast(success);
        } catch (e) {
          ok = false;
          setRoad(before);
          toast(e instanceof Error ? e.message : "Couldn't save. Try again.", "error");
        }
      });
      queue.current = run;
      await run;
      setSaving(false);
      return ok;
    },
    [entry, toast],
  );

  const value = useMemo(() => ({ road, entry, status, now, dispatch, saving, refresh }), [road, entry, status, now, dispatch, saving, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
