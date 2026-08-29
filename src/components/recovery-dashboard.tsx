import { LiveJourneys } from "./live-journeys";
import { RecoveryLinkConsole } from "./recovery-link-console";
import { IncidentExplanation } from "./incident-explanation";
import { OperationsPanels } from "./operations-panels";
import { PolicyConsole } from "./policy-console";
import { AuditTimeline } from "./audit-timeline";
import { OutcomeTotals } from "./outcome-totals";
import { RecoveryLab } from "./recovery-lab";
import { ManualReviewQueue } from "./manual-review-queue";
import { IncidentDetail } from "./incident-detail";

export function RecoveryDashboard() {
  return <main className="dashboard-shell">
    <header className="topbar"><div><p className="eyebrow">RecoveryOS / command center</p><h1>Find the leak. Protect every recovery.</h1></div><span className="demo-badge">Live rolling payment evidence</span></header>
    <IncidentDetail />
    <LiveJourneys />
    <RecoveryLinkConsole />
    <IncidentExplanation />
    <OperationsPanels />
    <PolicyConsole />
    <RecoveryLab />
    <ManualReviewQueue />
    <AuditTimeline />
    <OutcomeTotals />
  </main>;
}
