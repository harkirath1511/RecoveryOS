export function LoadingState({ label = "Loading evidence…" }: { label?: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><span><strong>Loading evidence</strong><small>{label}</small></span></div>;
}
