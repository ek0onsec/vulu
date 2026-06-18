import type { Deps } from "@/server/container";
import type { Domain } from "@/server/domain/entities";

export function searchCatalog(deps: Deps, query: string, domain: Domain) { return deps.catalog.searchWorks(query, domain); }
export function listGenres(deps: Deps, domain: Domain) { return deps.catalog.listGenres(domain); }
export function searchPeople(deps: Deps, query: string, domain: Domain) { return deps.catalog.searchPeople(query, domain); }
