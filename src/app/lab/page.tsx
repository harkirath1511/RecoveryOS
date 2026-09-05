import { OperatorShell } from "@/components/operator-shell";
import { RecoveryLab } from "@/components/recovery-lab";
import { requireOperatorPage } from "@/lib/auth/operator-page";

export default async function Page() {
  await requireOperatorPage();
  return <OperatorShell title="Recovery Lab" eyebrow="Lab / synthetic evidence"><RecoveryLab /></OperatorShell>;
}
