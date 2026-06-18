import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { LibraryClient } from "./LibraryClient";

export default async function LibraryPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><LibraryClient /></AppShell>;
}
