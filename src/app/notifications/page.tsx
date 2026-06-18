import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { NotificationsClient } from "./NotificationsClient";

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><NotificationsClient /></AppShell>;
}
