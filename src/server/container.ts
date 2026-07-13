import {
  InMemoryUserRepository, InMemoryFollowRepository, InMemoryWorkRepository,
  InMemoryLibraryEntryRepository, InMemoryListRepository, InMemoryLikeRepository, InMemoryCommentRepository,
  InMemoryFollowRequestRepository, InMemoryCommunityRepository, InMemoryMembershipRepository, InMemoryCommunityRequestRepository,
  InMemoryEpisodeCache, InMemoryEpisodeEntryRepository, InMemoryImportJobRepository,
} from "@/server/adapters/memory";
import { BcryptHasher } from "@/server/adapters/security/bcrypt-hasher";
import { JwtTokenService } from "@/server/adapters/security/jwt-token-service";
import { UuidIdGenerator } from "@/server/adapters/security/uuid-id-generator";
import { SystemClock } from "@/server/adapters/security/system-clock";
import { RandomInviteCodeGenerator } from "@/server/adapters/security/random-invite-code-generator";
import type {
  UserRepository, FollowRepository, FollowRequestRepository, WorkRepository, LibraryEntryRepository,
  ListRepository, LikeRepository, CommentRepository, CommunityRepository, MembershipRepository, CommunityRequestRepository,
  EpisodeCacheRepository, EpisodeEntryRepository, ImportJobRepository,
} from "@/server/ports/repositories";
import type { CatalogProvider } from "@/server/ports/catalog";
import type { PasswordHasher, TokenService, IdGenerator, Clock, Totp, Crypto, InviteCodeGenerator } from "@/server/ports/security";
import type { MediaStorage } from "@/server/ports/media";
import { LocalDiskStorage } from "@/server/adapters/media/local-disk-storage";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "@/server/adapters/mongo/client";
import {
  MongoUserRepository, MongoFollowRepository, MongoWorkRepository, MongoLibraryEntryRepository,
  MongoListRepository, MongoLikeRepository, MongoCommentRepository, MongoFollowRequestRepository,
  MongoCommunityRepository, MongoMembershipRepository, MongoCommunityRequestRepository,
  MongoEpisodeCache, MongoEpisodeEntryRepository, MongoImportJobRepository,
} from "@/server/adapters/mongo/repositories";
import { TmdbCatalog } from "@/server/adapters/catalog/tmdb-catalog";
import { GoogleBooksCatalog } from "@/server/adapters/catalog/google-books-catalog";
import { OpenLibraryBooks } from "@/server/adapters/catalog/open-library";
import { CompositeCatalog } from "@/server/adapters/catalog/composite-catalog";
import { OtplibTotp } from "@/server/adapters/security/otplib-totp";
import { NodeCrypto } from "@/server/adapters/security/node-crypto";
import { getEnv } from "@/lib/env";

export interface Deps {
  users: UserRepository;
  follows: FollowRepository;
  followRequests: FollowRequestRepository;
  communities: CommunityRepository;
  memberships: MembershipRepository;
  communityRequests: CommunityRequestRepository;
  works: WorkRepository;
  episodeCache: EpisodeCacheRepository;
  episodeEntries: EpisodeEntryRepository;
  importJobs: ImportJobRepository;
  entries: LibraryEntryRepository;
  lists: ListRepository;
  likes: LikeRepository;
  comments: CommentRepository;
  catalog: CatalogProvider;
  media: MediaStorage;
  hasher: PasswordHasher;
  tokens: TokenService;
  totp: Totp;
  crypto: Crypto;
  ids: IdGenerator;
  clock: Clock;
  inviteCodes: InviteCodeGenerator;
  founderCodes: ReadonlySet<string>;
}

/** Fabrique de dépendances in-memory pour les tests d'use-cases. */
export function makeInMemoryDeps(catalog: CatalogProvider): Deps {
  return {
    users: new InMemoryUserRepository(),
    follows: new InMemoryFollowRepository(),
    followRequests: new InMemoryFollowRequestRepository(),
    communities: new InMemoryCommunityRepository(),
    memberships: new InMemoryMembershipRepository(),
    communityRequests: new InMemoryCommunityRequestRepository(),
    works: new InMemoryWorkRepository(),
    episodeCache: new InMemoryEpisodeCache(),
    episodeEntries: new InMemoryEpisodeEntryRepository(),
    importJobs: new InMemoryImportJobRepository(),
    entries: new InMemoryLibraryEntryRepository(),
    lists: new InMemoryListRepository(),
    likes: new InMemoryLikeRepository(),
    comments: new InMemoryCommentRepository(),
    catalog,
    media: new LocalDiskStorage(join(tmpdir(), "vulu-test-uploads")),
    hasher: new BcryptHasher(4),
    tokens: new JwtTokenService("test-secret-test-secret-test-secret-32"),
    totp: new OtplibTotp(),
    crypto: new NodeCrypto("test-secret-test-secret-test-secret-32"),
    ids: new UuidIdGenerator(),
    clock: new SystemClock(),
    inviteCodes: new RandomInviteCodeGenerator(),
    founderCodes: new Set(["TESTCODE"]),
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
    followRequests: new MongoFollowRequestRepository(db),
    communities: new MongoCommunityRepository(db),
    memberships: new MongoMembershipRepository(db),
    communityRequests: new MongoCommunityRequestRepository(db),
    works: new MongoWorkRepository(db),
    episodeCache: new MongoEpisodeCache(db),
    episodeEntries: new MongoEpisodeEntryRepository(db),
    importJobs: new MongoImportJobRepository(db),
    entries: new MongoLibraryEntryRepository(db),
    lists: new MongoListRepository(db),
    likes: new MongoLikeRepository(db),
    comments: new MongoCommentRepository(db),
    catalog: new CompositeCatalog(
      new TmdbCatalog({ apiKey: env.TMDB_API_KEY, baseUrl: env.TMDB_BASE_URL, imageBase: env.TMDB_IMAGE_BASE }),
      new GoogleBooksCatalog(
        { baseUrl: env.GOOGLE_BOOKS_BASE_URL, apiKey: env.GOOGLE_BOOKS_API_KEY, coversBaseUrl: env.OPENLIBRARY_COVERS_BASE_URL },
        fetch,
        new OpenLibraryBooks({ baseUrl: env.OPENLIBRARY_BASE_URL }),
      ),
    ),
    media: new LocalDiskStorage(env.UPLOADS_DIR),
    hasher: new BcryptHasher(12),
    tokens: new JwtTokenService(env.JWT_SECRET),
    totp: new OtplibTotp(),
    crypto: new NodeCrypto(env.JWT_SECRET),
    ids: new UuidIdGenerator(),
    clock: new SystemClock(),
    inviteCodes: new RandomInviteCodeGenerator(),
    founderCodes: new Set(
      (env.INVITE_FOUNDER_CODES ?? "")
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length > 0),
    ),
  };
  return realDeps;
}
