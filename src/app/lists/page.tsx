import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { ListsClient } from "./ListsClient";

export default async function ListsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><ListsClient /></AppShell>;
}
