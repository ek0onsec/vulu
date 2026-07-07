export type ToastVariant = "success" | "error" | "info";
export interface ToastAction { label: string; onClick: () => void }
export interface ToastItem { id: number; message: string; variant: ToastVariant; durationMs: number; action?: ToastAction; key?: string }

/** Insère un toast dans la file : un toast porteur d'une `key` remplace celui de même clé (anti-empilement). */
export function mergeToast(items: ToastItem[], t: ToastItem): ToastItem[] {
  const base = t.key ? items.filter((x) => x.key !== t.key) : items;
  return [...base, t];
}

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let seq = 0;

/** Affiche un toast depuis n'importe quel composant client. */
export function toast(
  message: string,
  opts: ToastVariant | { variant?: ToastVariant; durationMs?: number; action?: ToastAction; key?: string } = "success",
): void {
  const o = typeof opts === "string" ? { variant: opts } : opts;
  const item: ToastItem = {
    id: ++seq, message,
    variant: o.variant ?? "success",
    durationMs: o.durationMs ?? (o.action ? 6000 : 2600),
    action: o.action,
    key: o.key,
  };
  for (const l of listeners) l(item);
}

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
