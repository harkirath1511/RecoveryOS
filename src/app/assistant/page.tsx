import { OperatorAssistant } from "@/components/operator-assistant";
import { OperatorShell } from "@/components/operator-shell";
import { requireOperatorPage } from "@/lib/auth/operator-page";

export default async function Page({ searchParams }: { searchParams: Promise<{ journey?: string }> }) {
  await requireOperatorPage();
  const { journey } = await searchParams;
  return <OperatorShell title="Evidence assistant" eyebrow="Groq evidence Q&A"><OperatorAssistant initialJourney={journey} /></OperatorShell>;
}
