import type { Deps } from "@/server/container";

export function searchCatalog(deps: Deps, query: string) { return deps.catalog.searchWorks(query); }
export function listGenres(deps: Deps) { return deps.catalog.listGenres(); }
export function searchPeople(deps: Deps, query: string) { return deps.catalog.searchPeople(query); }
