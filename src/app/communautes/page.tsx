import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { CommunitiesClient } from "./CommunitiesClient";

export default async function CommunitiesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><CommunitiesClient plus={user.plus} /></AppShell>;
}
