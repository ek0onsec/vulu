import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";

export interface TestMongo { db: Db; stop: () => Promise<void>; }

export async function startTestMongo(): Promise<TestMongo> {
  // Parrot OS (base Debian) est mal détecté par mongodb-memory-server → on épingle
  // une combinaison version/distribution qui publie bien un binaire.
  const server = await MongoMemoryServer.create({
    binary: { version: "7.0.14", os: { os: "linux", dist: "ubuntu", release: "22.04" } },
  });
  const client = new MongoClient(server.getUri());
  await client.connect();
  const db = client.db("vulu_test");
  return { db, stop: async () => { await client.close(); await server.stop(); } };
}
