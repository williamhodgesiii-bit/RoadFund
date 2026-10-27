"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during server render and hydration, true after. No effect or extra render needed. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** The URL hash without "#", kept in sync with navigation. Empty on the server. */
export function useHash(): string {
  return useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => "",
  );
}
