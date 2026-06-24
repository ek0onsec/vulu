"use client";
import { SearchPanel } from "@/components/SearchPanel";
import type { Domain } from "@/server/domain/entities";

export function SearchClient({ activeTabs }: { activeTabs: Domain[] }) {
  return <SearchPanel activeTabs={activeTabs} />;
}
