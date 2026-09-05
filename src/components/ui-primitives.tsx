import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "activity"
  | "arrow"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "command"
  | "evidence"
  | "flask"
  | "loop"
  | "menu"
  | "payments"
  | "recovery"
  | "search"
  | "shield"
  | "sidebar"
  | "warning";

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const paths: Record<IconName, ReactNode> = {
    activity: <><path d="M3 12h3l2.2-6 3.6 12 2.3-6H21" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    command: <><rect x="4" y="4" width="6" height="6" rx="2" /><rect x="14" y="4" width="6" height="6" rx="2" /><rect x="4" y="14" width="6" height="6" rx="2" /><rect x="14" y="14" width="6" height="6" rx="2" /></>,
    evidence: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
    flask: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /><path d="M8 15h8" /></>,
    loop: <><path d="M19.2 7.3A8.2 8.2 0 1 0 20 14" /><path d="M19.2 3.8v3.5h-3.5" /><circle cx="12" cy="12" r="2.1" /><path d="M5.3 16.6 7 14.9" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    payments: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></>,
    recovery: <><path d="M20 7v5h-5" /><path d="M18.5 16a8 8 0 1 1 .8-7L20 12" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8.2 7 10 4.2-1.8 7-5.3 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    sidebar: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
    warning: <><path d="m12 3 9 17H3z" /><path d="M12 9v4M12 17h.01" /></>,
  };
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}

export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral" | "synthetic";

export function statusTone(value: string | null | undefined): StatusTone {
  const normalized = value?.toUpperCase() ?? "";
  if (/FAILED|BLOCKED|HARD_DECLINED|NOT_RECOVERED|ERROR|STOPPED|CANCELLED|EXPIRED/.test(normalized)) return "danger";
  if (/CAPTURED|DIRECT_RECOVERY|NATURAL_LATE_CAPTURE|COMPLETED|EXECUTED|VERIFIED|ALLOWED|RESOLVED/.test(normalized)) return "success";
  if (/PENDING|WAIT|REVIEW|ELIGIBLE|AUTHORIZED|ATTENTION/.test(normalized)) return "warning";
  if (/SYNTHETIC|LAB|PREDICTED|ESTIMATED/.test(normalized)) return "synthetic";
  if (/ACTIVE|CURRENT|OPEN|CREATED|ATTEMPTED/.test(normalized)) return "info";
  return "neutral";
}

export function StatusBadge({ children, tone, dot = true, className = "" }: { children: ReactNode; tone?: StatusTone; dot?: boolean; className?: string }) {
  const text = typeof children === "string" ? children : "";
  const resolvedTone = tone ?? statusTone(text);
  return <span className={`status-badge status-${resolvedTone} ${className}`.trim()}>{dot && <span className="status-dot" aria-hidden="true" />}{children}</span>;
}

export function SourceBadge({ synthetic = false, children }: { synthetic?: boolean; children: ReactNode }) {
  return <StatusBadge tone={synthetic ? "synthetic" : "success"}>{children}</StatusBadge>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="panel-heading"><div><p className="card-label">{eyebrow}</p><h2>{title}</h2>{description && <p className="panel-footnote">{description}</p>}</div>{action}</div>;
}

export function EmptyState({ title, text, icon = "search" }: { title: string; text: string; icon?: IconName }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} /></span><strong>{title}</strong><p>{text}</p></div>;
}
