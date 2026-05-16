"use client";

import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatsGrid } from "@/components/ui/StatsGrid";
import { AuditTimeline } from "@/components/ui/AuditTimeline";
import { platformNav } from "@/lib/nav/menus";
import { getDashboardStats } from "@/lib/api/rbac";
import { listAuditLogs } from "@/lib/data/firestoreQueries";
import { useAsync } from "@/hooks/useAsync";

export default function PlatformAuditPage() {
  const stats = useAsync(() => getDashboardStats(), []);
  const audit = useAsync(() => listAuditLogs(20), []);

  return (
    <SectionFrame
      title="Audit & activity"
      subtitle="Operational trail and platform metrics"
      nav={platformNav()}
    >
      <PageIntro>
        Review recent platform actions alongside live counts. Audit entries capture seed events,
        admin decisions, and system operations — readable summaries without raw payloads.
      </PageIntro>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-lattice-navy">Recent activity</h2>
        <DataState loading={audit.loading} error={audit.error} onRetry={audit.reload} />
        {audit.data && <AuditTimeline entries={audit.data} />}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-lattice-navy">Platform metrics</h2>
        <DataState loading={stats.loading} error={stats.error} onRetry={stats.reload} />
        {stats.data && (
          <StatsGrid stats={stats.data as Record<string, unknown>} columns={3} />
        )}
      </section>
    </SectionFrame>
  );
}
