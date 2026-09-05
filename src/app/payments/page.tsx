import { OperatorShell } from "@/components/operator-shell";
import { JourneysScreen, type JourneyFilters } from "@/components/operator-screens";
import { requireOperatorPage } from "@/lib/auth/operator-page";

type PaymentSearchParams = Partial<Record<keyof JourneyFilters | "q", string | string[] | undefined>>;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<PaymentSearchParams> }) {
  await requireOperatorPage();
  const params = await searchParams;
  const first = (key: keyof PaymentSearchParams) => { const value = params[key]; return Array.isArray(value) ? value[0] : value; };
  const initialFilters: Partial<JourneyFilters> = Object.fromEntries((Object.keys({ query: "", state: "", provider: "", method: "", device: "", errorCode: "", workflow: "", outcome: "", balance: "", from: "", to: "", sort: "" }) as Array<keyof JourneyFilters>).flatMap(key => { const value = first(key); return value ? [[key, value]] : []; }));
  return <OperatorShell title="Payments" eyebrow="Payments / search"><JourneysScreen initialQuery={first("q") ?? ""} initialFilters={initialFilters} /></OperatorShell>;
}
