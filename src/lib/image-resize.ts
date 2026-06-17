/** Redimensionne une image (côté navigateur) dans un cadre max et renvoie des octets JPEG. */
export async function resizeImage(file: File, maxW: number, maxH: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponible");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Échec de l'encodage"))), "image/jpeg", quality);
  });
}
