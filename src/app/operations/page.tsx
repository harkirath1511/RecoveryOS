import { OperatorShell } from "@/components/operator-shell"; import { OperationsScreen } from "@/components/operator-screens"; import { requireOperatorPage } from "@/lib/auth/operator-page";
export default async function Page(){await requireOperatorPage();return <OperatorShell title="Recovery operations" eyebrow="Operations"><OperationsScreen /></OperatorShell>}
