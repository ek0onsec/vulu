/**
 * Hook de démarrage Next.js : crée les index Mongo (idempotent) au boot du serveur.
 * Remplace un script tsx autonome (qui ne résoudrait pas les alias `@/`).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getDb } = await import("@/server/adapters/mongo/client");
    const { ensureIndexes } = await import("@/server/adapters/mongo/indexes");
    await ensureIndexes(await getDb());
    console.log("[vulu] index Mongo vérifiés.");
  } catch (error) {
    console.error("[vulu] échec de la création des index Mongo (vérifie MONGODB_URI) :", error);
  }
}
