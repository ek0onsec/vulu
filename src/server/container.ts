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
