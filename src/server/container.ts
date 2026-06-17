import {
  InMemoryUserRepository, InMemoryFollowRepository, InMemoryWorkRepository,
  InMemoryLibraryEntryRepository, InMemoryListRepository, InMemoryLikeRepository, InMemoryCommentRepository,
} from "@/server/adapters/memory";
import { BcryptHasher } from "@/server/adapters/security/bcrypt-hasher";
import { JwtTokenService } from "@/server/adapters/security/jwt-token-service";
import { UuidIdGenerator } from "@/server/adapters/security/uuid-id-generator";
import { SystemClock } from "@/server/adapters/security/system-clock";
import type {
  UserRepository, FollowRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository,
} from "@/server/ports/repositories";
import type { CatalogProvider } from "@/server/ports/catalog";
import type { PasswordHasher, TokenService, IdGenerator, Clock } from "@/server/ports/security";
import { getDb } from "@/server/adapters/mongo/client";
import {
  MongoUserRepository, MongoFollowRepository, MongoWorkRepository, MongoLibraryEntryRepository,
  MongoListRepository, MongoLikeRepository, MongoCommentRepository,
} from "@/server/adapters/mongo/repositories";
import { TmdbCatalog } from "@/server/adapters/catalog/tmdb-catalog";
import { getEnv } from "@/lib/env";

export interface Deps {
  users: UserRepository;
  follows: FollowRepository;
  works: WorkRepository;
  entries: LibraryEntryRepository;
  lists: ListRepository;
  likes: LikeRepository;
  comments: CommentRepository;
  catalog: CatalogProvider;
  hasher: PasswordHasher;
  tokens: TokenService;
  ids: IdGenerator;
  clock: Clock;
}

/** Fabrique de dépendances in-memory pour les tests d'use-cases. */
export function makeInMemoryDeps(catalog: CatalogProvider): Deps {
  return {
    users: new InMemoryUserRepository(),
    follows: new InMemoryFollowRepository(),
    works: new InMemoryWorkRepository(),
    entries: new InMemoryLibraryEntryRepository(),
    lists: new InMemoryListRepository(),
    likes: new InMemoryLikeRepository(),
    comments: new InMemoryCommentRepository(),
    catalog,
    hasher: new BcryptHasher(4),
    tokens: new JwtTokenService("test-secret-test-secret-test-secret-32"),
    ids: new UuidIdGenerator(),
    clock: new SystemClock(),
  };
}

let realDeps: Deps | null = null;

/** Dépendances de production (Mongo + TMDB + sécurité réelle). Singleton. */
export async function getDeps(): Promise<Deps> {
  if (realDeps) return realDeps;
  const env = getEnv();
  const db = await getDb();
  realDeps = {
    users: new MongoUserRepository(db),
    follows: new MongoFollowRepository(db),
    works: new MongoWorkRepository(db),
    entries: new MongoLibraryEntryRepository(db),
    lists: new MongoListRepository(db),
    likes: new MongoLikeRepository(db),
    comments: new MongoCommentRepository(db),
    catalog: new TmdbCatalog({ apiKey: env.TMDB_API_KEY, baseUrl: env.TMDB_BASE_URL, imageBase: env.TMDB_IMAGE_BASE }),
    hasher: new BcryptHasher(12),
    tokens: new JwtTokenService(env.JWT_SECRET),
    ids: new UuidIdGenerator(),
    clock: new SystemClock(),
  };
  return realDeps;
}
