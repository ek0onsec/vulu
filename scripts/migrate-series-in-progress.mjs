// Passe en "in_progress" les séries "done" dont tous les épisodes ne sont pas cochés.
// Idempotent. Dry-run par défaut ; --apply pour écrire.
// Usage : MONGODB_URI=… MONGODB_DB=vulu node scripts/migrate-series-in-progress.mjs [--apply]
import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "vulu";
if (!uri) { console.error("MONGODB_URI manquant"); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const doneEntries = await db.collection("entries").find({ status: "done" }).toArray();
let series = 0, ignored = 0, toChange = 0;
const ids = [];
for (const e of doneEntries) {
  const work = await db.collection("works").findOne({ _id: e.workId });
  if (!work || work.type !== "tv") continue;
  series++;
  const counts = Array.isArray(work.episodeCounts) ? work.episodeCounts : null;
  if (!counts || counts.length === 0) { ignored++; continue; }
  const total = counts.reduce((a, b) => a + b, 0);
  const grid = e.progress && Array.isArray(e.progress.watchedEpisodes) ? e.progress.watchedEpisodes : [];
  const watched = grid.reduce((n, s) => n + (Array.isArray(s) ? s.length : 0), 0);
  if (watched < total) { toChange++; ids.push(e._id); }
}

console.log(`Séries "done" : ${series} | ignorées (episodeCounts inconnu) : ${ignored} | à passer en in_progress : ${toChange}`);
if (apply && ids.length) {
  const res = await db.collection("entries").updateMany(
    { _id: { $in: ids } },
    { $set: { status: "in_progress", completedAt: null } },
  );
  console.log(`Appliqué : ${res.modifiedCount} entrées modifiées.`);
} else if (!apply) {
  console.log("Dry-run : aucune écriture. Relancer avec --apply pour appliquer.");
}
await client.close();
