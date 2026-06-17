import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  const env = getEnv();
  client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();
  db = client.db(env.MONGODB_DB);
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null; db = null;
}
