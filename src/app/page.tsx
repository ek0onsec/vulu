import { redirect } from "next/navigation";
import { currentUser } from "@/server/http/session";

export default async function Home() {
  const user = await currentUser();
  redirect(user ? "/feed" : "/login");
}
