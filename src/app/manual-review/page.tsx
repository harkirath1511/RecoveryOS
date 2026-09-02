import { OperatorShell } from "@/components/operator-shell"; import { ManualReviewScreen } from "@/components/operator-screens"; import { requireOperatorPage } from "@/lib/auth/operator-page";
export default async function Page(){await requireOperatorPage();return <OperatorShell title="Manual review" eyebrow="Manual review"><ManualReviewScreen /></OperatorShell>}
