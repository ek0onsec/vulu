// Clone LECTURE-SEULE des données de Margot depuis l'Atlas prod vers le Mongo local.
// Prérequis : `npm run local-mongo` doit tourner (destination sur 127.0.0.1:27017).
// Source (Atlas) lue depuis .env.local. AUCUNE écriture sur la source.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MARGOT_EMAIL = "delettremargot03@gmail.com";
const DEST_URI = process.env.DEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const DEST_DB = "vulu";

/** Parse un .env simple (split sur le premier '='). */
function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

/** Purge puis réinsère les documents dans une collection de destination. */
async function replaceCollection(destDb, name, docs) {
  await destDb.collection(name).deleteMany({});
  if (docs.length) await destDb.collection(name).insertMany(docs);
  console.log(`  ${name}: ${docs.length}`);
}

async function main() {
  const env = parseEnv(resolve(process.cwd(), ".env.local"));
  const srcUri = env.MONGODB_URI;
  const srcDb = env.MONGODB_DB || "vulu";
  if (!srcUri) throw new Error(".env.local: MONGODB_URI (Atlas) introuvable");

  const src = new MongoClient(srcUri, { maxPoolSize: 5 });
  const dst = new MongoClient(DEST_URI, { maxPoolSize: 5 });
  await src.connect();
  await dst.connect();
  try {
    const S = src.db(srcDb);
    const D = dst.db(DEST_DB);

    const margot = await S.collection("users").findOne({ email: MARGOT_EMAIL });
    if (!margot) throw new Error(`Utilisatrice introuvable en prod: ${MARGOT_EMAIL}`);
    const userId = margot._id;
    console.log(`Margot trouvée: _id=${userId}`);

    // 1) User
    await replaceCollection(D, "users", [margot]);

    // 2) Collections lui appartenant (filtre userId)
    const entries = await S.collection("entries").find({ userId }).toArray();
    const episodeEntries = await S.collection("episode_entries").find({ userId }).toArray();
    const lists = await S.collection("lists").find({ userId }).toArray();
    const likes = await S.collection("likes").find({ userId }).toArray();
    const comments = await S.collection("comments").find({ userId }).toArray();
    await replaceCollection(D, "entries", entries);
    await replaceCollection(D, "episode_entries", episodeEntries);
    await replaceCollection(D, "lists", lists);
    await replaceCollection(D, "likes", likes);
    await replaceCollection(D, "comments", comments);

    // 3) Works référencés par ses entries + episode_entries
    const workIds = [...new Set([...entries, ...episodeEntries].map((e) => e.workId).filter(Boolean))];
    const works = workIds.length ? await S.collection("works").find({ _id: { $in: workIds } }).toArray() : [];
    await replaceCollection(D, "works", works);

    // 4) episode_cache pour les (source, externalId) des works clonés
    const keys = works.map((w) => ({ source: w.source, externalId: w.externalId }));
    const cache = keys.length ? await S.collection("episode_cache").find({ $or: keys }).toArray() : [];
    await replaceCollection(D, "episode_cache", cache);

    console.log("Clonage terminé.");
  } finally {
    await src.close();
    await dst.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
