// Démarre un MongoDB en mémoire et écrit son URI dans /tmp/vulu-smoke-uri, puis reste vivant.
import { MongoMemoryServer } from "mongodb-memory-server";
import { writeFileSync } from "node:fs";

const server = await MongoMemoryServer.create({
  binary: { version: "7.0.14", os: { os: "linux", dist: "ubuntu", release: "22.04" } },
});
writeFileSync("/tmp/vulu-smoke-uri", server.getUri());
console.log("MONGO_READY");
setInterval(() => {}, 1 << 30);
