import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><SettingsClient initialTastes={user.tastes} /></AppShell>;
}
