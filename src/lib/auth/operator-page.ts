import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";

export async function requireOperatorPage() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!verifySessionToken(token)) redirect("/login");
}
