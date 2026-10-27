"use client";

/**
 * Shrinks a phone photo before it is stored or sent. A 4 MB camera photo
 * becomes ~150–300 KB, which matters on a weak rural signal.
 */
export async function shrinkImage(file: File | Blob, maxSide = 1400, quality = 0.78): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return blob && blob.size < file.size ? blob : file;
}

export const ACCEPT_UPLOADS = "image/jpeg,image/png,image/webp,application/pdf";
