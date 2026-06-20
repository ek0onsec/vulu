import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { getDeps } from "@/server/container";
import { getPersonProfile } from "@/server/application/person";
import { parsePersonId } from "@/lib/person";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { PersonClient } from "./PersonClient";

export default async function PersonPage(
  { params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ name?: string }> },
) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const ref = parsePersonId(id);
  if (!ref || !sp.name) notFound();
  const profile = await getPersonProfile(await getDeps(), user.id, { ...ref, name: sp.name });
  return <AppShell><BackButton fallback="/recherche" /><PersonClient profile={profile} /></AppShell>;
}
