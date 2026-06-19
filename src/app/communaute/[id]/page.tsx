import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { CommunityClient } from "./CommunityClient";

export default async function CommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  return <AppShell><BackButton fallback="/communautes" /><CommunityClient id={id} /></AppShell>;
}
