export type ToastVariant = "success" | "error" | "info";
export interface ToastAction { label: string; onClick: () => void }
export interface ToastItem { id: number; message: string; variant: ToastVariant; durationMs: number; action?: ToastAction }

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let seq = 0;

/** Affiche un toast depuis n'importe quel composant client. */
export function toast(
  message: string,
  opts: ToastVariant | { variant?: ToastVariant; durationMs?: number; action?: ToastAction } = "success",
): void {
  const o = typeof opts === "string" ? { variant: opts } : opts;
  const item: ToastItem = {
    id: ++seq, message,
    variant: o.variant ?? "success",
    durationMs: o.durationMs ?? (o.action ? 6000 : 2600),
    action: o.action,
  };
  for (const l of listeners) l(item);
}

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
