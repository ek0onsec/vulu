import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { PlusClient } from "./PlusClient";

export default async function PlusPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell><PlusClient active={user.plus} /></AppShell>;
}
