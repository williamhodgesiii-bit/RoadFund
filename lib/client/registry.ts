"use client";

// Which roads this browser manages, and where each one is stored.

export interface RoadEntry {
  id: string;
  name: string;
  where: "local" | "cloud";
  /** Captain key for cloud roads. Never sent anywhere except this road's API. */
  key: string | null;
  addedAt: string;
  demo: boolean;
}

const LIST = "rf:roads";
const ACTIVE = "rf:active";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked. The app keeps working for this session.
  }
}

export function listRoads(): RoadEntry[] {
  return read<RoadEntry[]>(LIST, []);
}

export function getEntry(id: string): RoadEntry | null {
  return listRoads().find((r) => r.id === id) ?? null;
}

export function saveEntry(entry: RoadEntry) {
  const list = listRoads().filter((r) => r.id !== entry.id);
  write(LIST, [entry, ...list]);
}

export function removeEntry(id: string) {
  write(
    LIST,
    listRoads().filter((r) => r.id !== id),
  );
  if (getActiveId() === id) {
    try {
      localStorage.removeItem(ACTIVE);
    } catch {}
  }
}

export function getActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE);
  } catch {
    return null;
  }
}

export function setActiveId(id: string) {
  try {
    localStorage.setItem(ACTIVE, id);
  } catch {}
}

export function activeEntry(): RoadEntry | null {
  const list = listRoads();
  const id = getActiveId();
  return list.find((r) => r.id === id) ?? list[0] ?? null;
}

export function renameEntry(id: string, name: string) {
  const e = getEntry(id);
  if (e && e.name !== name) saveEntry({ ...e, name });
}
