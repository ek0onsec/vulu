export type ToastVariant = "success" | "error" | "info";
export interface ToastItem { id: number; message: string; variant: ToastVariant; }

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let seq = 0;

/** Affiche un toast depuis n'importe quel composant client. */
export function toast(message: string, variant: ToastVariant = "success"): void {
  const item: ToastItem = { id: ++seq, message, variant };
  for (const l of listeners) l(item);
}

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
