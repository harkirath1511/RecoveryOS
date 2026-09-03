import { OperatorShell } from "@/components/operator-shell"; import { IncidentsScreen } from "@/components/operator-screens"; import { requireOperatorPage } from "@/lib/auth/operator-page";
export default async function Page(){await requireOperatorPage();return <OperatorShell title="Incidents" eyebrow="Incident register"><IncidentsScreen /></OperatorShell>}
