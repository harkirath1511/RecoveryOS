export type PaymentSearchParameters = Partial<Record<"query" | "provider" | "method" | "device", string>>;

/** Converts a persisted incident-detector cohort into existing Payments filters. */
export function incidentPaymentFilters(cohortKey: string): PaymentSearchParameters {
  const [kind, encodedValues = ""] = cohortKey.split(":", 2);
  const [provider, methodOrError, device] = encodedValues.split("|");

  switch (kind) {
    case "provider": return { provider };
    case "method": return { method: provider };
    case "device": return { device: provider };
    case "error": return { query: provider };
    case "provider-method": return { provider, method: methodOrError };
    case "provider-error": return { provider, query: methodOrError };
    case "provider-method-device": return { provider, method: methodOrError, device };
    default: return {};
  }
}
