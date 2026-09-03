import { OperatorShell } from "@/components/operator-shell";
import { OverviewScreen } from "@/components/overview-screen";
import { requireOperatorPage } from "@/lib/auth/operator-page";

export default async function HomePage() {
  await requireOperatorPage();
  return <OperatorShell title="Command center" eyebrow="Overview"><OverviewScreen /></OperatorShell>;
}
