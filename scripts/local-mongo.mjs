// Démarre un MongoDB local PERSISTANT sur le port 27017 et reste vivant (Ctrl+C pour arrêter).
// Bac à sable de dev : `npm run dev` s'y connecte via .env.development.local.
import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dbPath = resolve(process.cwd(), ".local-mongo");
mkdirSync(dbPath, { recursive: true });

// Parrot OS (base Debian) est mal détecté par mongodb-memory-server → binaire épinglé.
const server = await MongoMemoryServer.create({
  binary: { version: "7.0.14", os: { os: "linux", dist: "ubuntu", release: "22.04" } },
  instance: { port: 27017, dbPath, storageEngine: "wiredTiger" },
});

console.log(`[local-mongo] prêt sur ${server.getUri()} (dbPath: ${dbPath})`);
console.log("[local-mongo] Ctrl+C pour arrêter. Les données sont conservées.");

async function shutdown() {
  console.log("\n[local-mongo] arrêt (données conservées)…");
  await server.stop({ doCleanup: false, force: false });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
