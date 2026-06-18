import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { SearchClient } from "./SearchClient";

export default async function SearchPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><SearchClient activeTabs={user.activeTabs} /></AppShell>;
}
