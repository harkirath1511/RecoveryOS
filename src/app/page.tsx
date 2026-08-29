import { RecoveryDashboard } from "@/components/recovery-dashboard";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";

export default async function HomePage() {
  const token=(await cookies()).get(sessionCookieName)?.value;
  if(!verifySessionToken(token)) redirect("/login");
  return <RecoveryDashboard />;
}
