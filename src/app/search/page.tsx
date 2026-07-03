import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { SearchClient } from "./SearchClient";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; domain?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { q, domain } = await searchParams;
  const initialDomain = domain === "films" || domain === "books" ? domain : undefined;
  return <AppShell><SearchClient activeTabs={user.activeTabs} initialQuery={q} initialDomain={initialDomain} /></AppShell>;
}
