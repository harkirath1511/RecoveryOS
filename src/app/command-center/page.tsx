import { OperatorShell } from "@/components/operator-shell";
import { OverviewScreen } from "@/components/overview-screen";
import { requireOperatorPage } from "@/lib/auth/operator-page";

export default async function CommandCenterPage() {
  await requireOperatorPage();
  return <OperatorShell title="Command center" eyebrow="Operations overview"><OverviewScreen /></OperatorShell>;
}
