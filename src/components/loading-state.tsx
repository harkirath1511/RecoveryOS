export function LoadingState({ label = "Loading evidence…" }: { label?: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" />{label}</div>;
}
