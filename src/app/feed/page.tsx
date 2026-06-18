import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { FeedClient } from "./FeedClient";

export default async function FeedPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <AppShell>
      <FeedClient activeTabs={user.activeTabs} displayName={user.displayName} avatarUrl={user.avatarUrl} />
    </AppShell>
  );
}
