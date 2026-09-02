import { OperatorShell } from "@/components/operator-shell"; import { AuditScreen } from "@/components/operator-screens"; import { requireOperatorPage } from "@/lib/auth/operator-page";
export default async function Page(){await requireOperatorPage();return <OperatorShell title="Evidence and audit" eyebrow="Audit"><AuditScreen /></OperatorShell>}
