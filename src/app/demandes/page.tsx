import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { RequestsClient } from "./RequestsClient";

export default async function RequestsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><BackButton fallback="/parametres" /><RequestsClient /></AppShell>;
}
