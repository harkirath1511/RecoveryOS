import { OperatorShell } from "@/components/operator-shell";
import { EvidenceScreen } from "@/components/operator-screens";
import { requireOperatorPage } from "@/lib/auth/operator-page";

export default async function EvidencePage() {
  await requireOperatorPage();
  return <OperatorShell title="Evidence" eyebrow="Evidence / investigation"><EvidenceScreen /></OperatorShell>;
}
