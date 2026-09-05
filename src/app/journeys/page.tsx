import { OperatorShell } from "@/components/operator-shell"; import { JourneysScreen } from "@/components/operator-screens"; import { requireOperatorPage } from "@/lib/auth/operator-page";
export default async function Page(){await requireOperatorPage();return <OperatorShell title="Payments" eyebrow="Payments / legacy link"><JourneysScreen /></OperatorShell>}
