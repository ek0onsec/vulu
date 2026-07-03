"use client";
import { SearchPanel } from "@/components/SearchPanel";
import type { Domain } from "@/server/domain/entities";

export function SearchClient({ activeTabs, initialQuery, initialDomain }: { activeTabs: Domain[]; initialQuery?: string; initialDomain?: Domain }) {
  return <SearchPanel activeTabs={activeTabs} initialQuery={initialQuery} initialDomain={initialDomain} />;
}
