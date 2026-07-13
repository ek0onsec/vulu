// CLI de dev : importe un export TV Time dans le Mongo LOCAL pour l'utilisatrice cible.
// Prérequis : `npm run local-mongo` doit tourner. Usage : npm run import:tvtime <dossier-export>
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const MARGOT_EMAIL = "delettremargot03@gmail.com";

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir) { console.error("Usage: npm run import:tvtime <dossier-export>"); process.exit(1); }

  // TMDB_* + JWT_SECRET depuis .env.local ; Mongo forcé sur le bac à sable local.
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.MONGODB_DB = "vulu";

  const { getDeps } = await import("@/server/container");
  const { parseTvTimeExport } = await import("@/server/import/tvtime-parser");
  const { importTvTime } = await import("@/server/application/import-tvtime");

  const read = (f: string) => readFileSync(join(dir, f), "utf8");
  const data = parseTvTimeExport({
    followedShows: read("followed_tv_show.csv"),
    trackingV2: read("tracking-prod-records-v2.csv"),
    trackingV1: read("tracking-prod-records.csv"),
  });
  console.log(`Parsé : ${data.series.length} séries, ${data.movies.length} films.`);

  const deps = await getDeps();
  const user = await deps.users.findByEmail(MARGOT_EMAIL);
  if (!user) { console.error(`Utilisatrice introuvable en local : ${MARGOT_EMAIL}`); process.exit(1); }

  const report = await importTvTime(deps, user.id, data);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
