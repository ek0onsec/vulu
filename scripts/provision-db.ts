import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/server/adapters/mongo/indexes.ts";

/**
 * Provisionne une base Mongo vide : crée chaque collection puis ses index.
 * Idempotent — relançable sans effet de bord. Les index proviennent de la
 * source unique `ensureIndexes` (aucune duplication de définition ici).
 *
 * Usage : MONGODB_URI="..." MONGODB_DB="vulu" node scripts/provision-db.ts
 */
const COLLECTIONS = [
  "users", "follows", "follow_requests",
  "communities", "memberships", "community_requests",
  "works", "entries", "lists", "likes", "comments",
] as const;

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) throw new Error("MONGODB_URI et MONGODB_DB sont requis");

  const client = new MongoClient(uri, { maxPoolSize: 5 });
  await client.connect();
  try {
    const db = client.db(dbName);

    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    for (const name of COLLECTIONS) {
      if (existing.has(name)) {
        console.log(`= collection déjà présente : ${name}`);
      } else {
        await db.createCollection(name);
        console.log(`+ collection créée : ${name}`);
      }
    }

    await ensureIndexes(db);
    console.log(`\nIndex provisionnés sur ${dbName}. Base prête.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Échec du provisioning :", err);
  process.exitCode = 1;
});
