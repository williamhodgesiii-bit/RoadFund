// Unambiguous alphabet for codes people read aloud or type (no 0/O, 1/I/L).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomFrom(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** Short random id with a readable prefix, e.g. "pay_k3j9x0q2m1" */
export function uid(prefix: string): string {
  return `${prefix}_${randomFrom(ID_ALPHABET, 12)}`;
}

/** 128-bit URL-safe secret for neighbor and captain links. */
export function secretToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Public road code a title company can type: "RF-7KQ2MX" */
export function roadCode(): string {
  return `RF-${randomFrom(CODE_ALPHABET, 6)}`;
}

/** Letter verification code: "K7QM-2XPD" */
export function letterCode(): string {
  const raw = randomFrom(CODE_ALPHABET, 8);
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
