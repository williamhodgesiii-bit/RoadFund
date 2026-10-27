"use client";

// Photos and PDFs. Local mode keeps them in IndexedDB on this device; cloud
// mode uploads them to the server and serves them by an unguessable id.

import type { RoadEntry } from "./registry";

const DB = "roadfund";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(id: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** ~124 random bits, so a file URL can't be guessed. */
export function newFileId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `file_${Array.from(bytes, (b) => (b % 36).toString(36)).join("")}`;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

export async function saveFile(entry: RoadEntry | { where: "local" | "cloud"; id: string; key: string | null }, blob: Blob): Promise<string> {
  const id = newFileId();
  if (entry.where === "cloud") {
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-road-key": entry.key ?? "" },
      body: JSON.stringify({ roadId: entry.id, id, mime: blob.type, data: await blobToBase64(blob) }),
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed");
  } else {
    await idbPut(id, blob);
  }
  return id;
}

const urlCache = new Map<string, string>();

/** A URL for <img src> or a download link. Null when the file isn't on this device. */
export async function fileUrl(where: "local" | "cloud", id: string): Promise<string | null> {
  if (where === "cloud") return `/api/files/${id}`;
  const cached = urlCache.get(id);
  if (cached) return cached;
  try {
    const blob = await idbGet(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}
