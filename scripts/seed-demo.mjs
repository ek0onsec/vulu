// Remplit la base (URI lu dans /tmp/vulu-smoke-uri) avec un compte démo + du contenu,
// pour explorer l'UI sans dépendre de TMDB. À NE PAS utiliser en production.
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";

const uri = process.env.MONGODB_URI || readFileSync("/tmp/vulu-smoke-uri", "utf8").trim();
const client = new MongoClient(uri);
await client.connect();
const db = client.db("vulu");

const now = new Date();
const hash = await bcrypt.hash("password1", 6);

const user = (id, username, displayName, bio, avatarUrl = null, bannerUrl = null, activeTabs = ["films"], plus = false, staff = false, isPrivate = false) => ({
  _id: id, id, email: `${username}@vulu.app`, passwordHash: hash, username, displayName,
  bio, avatarUrl, bannerUrl, activeTabs,
  tastes: { filmGenreIds: [28, 18, 878], people: [] }, showcase: { movie: [], tv: [], book: [] }, plus, staff, private: isPrivate, twoFactorEnabled: false, deactivatedAt: null, notificationsSeenAt: null, createdAt: now,
});

const work = (id, externalId, type, title, year, seed, overview, genres) => ({
  _id: id, id, source: "tmdb", externalId, type, domain: "films", title, year,
  posterUrl: `https://picsum.photos/seed/${seed}/400/600`,
  backdropUrl: `https://picsum.photos/seed/${seed}-bg/1280/400`,
  overview, genres, people: [{ tmdbId: 1, name: "Réalisateur Démo", role: "director" }],
  externalRating: 7.8, watchProviders: [{ name: "Netflix", logoUrl: null }, { name: "Prime Video", logoUrl: null }],
  cachedAt: now,
});

const entry = (id, userId, workId, rating, text, visibility, daysAgo) => ({
  _id: id, id, userId, workId, domain: "films", status: "done", rating, text, visibility,
  createdAt: new Date(now.getTime() - daysAgo * 86400000),
  updatedAt: new Date(now.getTime() - daysAgo * 86400000),
});

for (const c of ["users", "works", "entries", "follows", "likes", "comments", "lists"]) {
  await db.collection(c).deleteMany({});
}

await db.collection("users").insertMany([
  user("u-demo", "demo", "Toi (démo)", "Compte de démonstration vulu.", null, "https://picsum.photos/seed/demo-banner/1500/500", ["films", "books"], true, true),
  user("u-alice", "alice", "Alice", "Cinéphile du dimanche, dévoreuse de SF.", "https://picsum.photos/seed/alice-av/200/200", null, ["films", "books"], true),
  user("u-bob", "bob", "Bob", "Séries only. Spoilers jamais."),
]);

await db.collection("works").insertMany([
  work("w-dune", "693134", "movie", "Dune : Deuxième partie", 2024, "dune", "Paul Atréides s'unit aux Fremen pour mener la révolte.", ["Science-fiction", "Aventure"]),
  work("w-bear", "136315", "tv", "The Bear", 2022, "bear", "Un chef étoilé reprend le sandwicherie familiale à Chicago.", ["Comédie", "Drame"]),
  work("w-matrix", "603", "movie", "The Matrix", 1999, "matrix", "Un hacker découvre la vraie nature de sa réalité.", ["Science-fiction", "Action"]),
  work("w-poor", "817758", "movie", "Pauvres Créatures", 2023, "poor", "Bella Baxter ressuscitée explore le monde sans préjugés.", ["Drame", "Fantastique"]),
]);

await db.collection("entries").insertMany([
  entry("e-1", "u-alice", "w-dune", 4.6, "Villeneuve confirme : une fresque visuelle hypnotique.", "circle", 0),
  entry("e-2", "u-bob", "w-bear", 4.8, "La saison la plus intense. « Yes, chef. »", "public", 1),
  entry("e-3", "u-alice", "w-matrix", 5.0, "Le film qui a redéfini la SF. Indémodable.", "public", 2),
  entry("e-4", "u-bob", "w-poor", 3.7, "Esthétique folle, un peu longuet sur la fin.", "public", 3),
  entry("e-5", "u-demo", "w-dune", 4.2, "Vu en IMAX, claque garantie.", "public", 4),
]);

// demo suit alice (cercle) — bob est en public
await db.collection("follows").insertMany([
  { _id: "u-demo:u-alice", followerId: "u-demo", followeeId: "u-alice", createdAt: now },
  { _id: "u-alice:u-demo", followerId: "u-alice", followeeId: "u-demo", createdAt: now },
]);

await db.collection("likes").insertMany([
  { _id: "e-2:u-demo", entryId: "e-2", userId: "u-demo", createdAt: now },
  { _id: "e-3:u-alice", entryId: "e-3", userId: "u-alice", createdAt: now },
]);

await db.collection("comments").insertOne({
  _id: "c-1", id: "c-1", entryId: "e-2", userId: "u-alice", text: "Tellement d'accord !", createdAt: now,
});

await db.collection("lists").insertOne({
  _id: "l-1", id: "l-1", userId: "u-demo", name: "SF culte", kind: "mixed",
  description: "Mes incontournables.", bannerUrl: null, visibility: "public", workIds: ["w-dune", "w-matrix", "w-poor"],
  createdAt: now, updatedAt: now,
});

await db.collection("users").updateOne({ _id: "u-demo" }, { $set: { showcase: { movie: ["w-dune", "w-matrix"], tv: [], book: [] } } });

console.log("SEED_OK");
await client.close();
process.exit(0);
