import type { EntryStatus, WorkType } from "@/server/domain/entities";

/** Libellé de statut adapté au type d'œuvre (livres : à lire/lu ; sinon : à voir/vu). */
export function statusLabel(status: EntryStatus, type: WorkType): string {
  if (status === "in_progress") return "En cours";
  const book = type === "book";
  if (status === "planned") return book ? "À lire" : "À voir";
  return book ? "Lu" : "Vu"; // done
}
