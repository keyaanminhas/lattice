"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { orgNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { PageIntro } from "@/components/ui/PageIntro";
import { AiButton } from "@/components/ui/AiButton";
import { useOnDemand } from "@/hooks/useOnDemand";
import { getAiInsights } from "@/lib/api/rbac";
import { InsightList, normaliseInsights } from "@/components/ui/InsightList";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { NarrativePanel } from "@/components/ui/NarrativePanel";
import { SignalBars } from "@/components/ui/SignalBars";
import { listOrgReviewQueue, getOrganisation } from "@/lib/data/firestoreQueries";

export default function OrgAdminDashboard() {
  const { orgId } = useParams<{ orgId: string }>();
  const org = useAsync(() => getOrganisation(orgId), [orgId]);
  const queue = useAsync(() => listOrgReviewQueue(orgId), [orgId]);
  const insights = useOnDemand(() => getAiInsights());
  const orgName = org.data ? String(org.data.name) : orgId;
  const queueData = queue.data;

  const queueStats = queueData
    ? {
        applications: queueData.apps.length,
        recommendations: queueData.recs.length,
        avgApplicationScore:
          queueData.apps.length > 0
            ? Math.round(
                queueData.apps.reduce((sum, row) => sum + Number(row.aiFitScore ?? 0), 0) /
                  queueData.apps.length,
              )
            : 0,
        avgRecommendationScore:
          queueData.recs.length > 0
            ? Math.round(
                queueData.recs.reduce((sum, row) => sum + Number(row.matchScore ?? 0), 0) /
                  queueData.recs.length,
              )
            : 0,
      }
    : null;

  return (
    <SectionFrame title="Organisation command" subtitle={orgName} nav={orgNav(orgId)}>
      <PageIntro>
        {orgName} review queue combines pending startup applications and mentor match approvals.
        The goal is not just to clear items quickly, but to keep programme flow credible by making
        AI scores, review pressure, and next actions visible on the same screen.
      </PageIntro>

      {queueStats && (
        <MetricStrip
          columns={4}
          items={[
            {
              label: "Applications in queue",
              value: queueStats.applications,
              detail: "Startups waiting for programme-level decisions.",
              tone: queueStats.applications > 0 ? "warning" : "default",
            },
            {
              label: "Matches in queue",
              value: queueStats.recommendations,
              detail: "AI-generated mentor recommendations awaiting approval.",
              tone: queueStats.recommendations > 0 ? "accent" : "default",
            },
            {
              label: "Avg application score",
              value: queueStats.avgApplicationScore || "-",
              detail: "Mean AI fit score across pending startup applications.",
            },
            {
              label: "Avg match score",
              value: queueStats.avgRecommendationScore || "-",
              detail: "Mean mentor recommendation score across current reviews.",
            },
          ]}
        />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <div className="mb-1">
            <AiButton variant="ghost" disabled={insights.loading} onClick={() => insights.run()}>
              {insights.loading ? "Generating..." : "AI org insights"}
            </AiButton>
            {insights.data && (
              <div className="mt-3 lattice-panel p-4">
                <InsightList items={normaliseInsights(insights.data.insights)} />
              </div>
            )}
          </div>

          <DataState
            loading={queue.loading}
            error={queue.error}
            empty={!queue.loading && !queue.error && !queueData?.apps.length && !queueData?.recs.length}
            onRetry={queue.reload}
          />

          {queueData && (queueData.apps.length > 0 || queueData.recs.length > 0) && (
            <div className="lattice-panel overflow-auto">
              <table className="lattice-data-grid">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Programme / Mentor</th>
                    <th>AI score</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {queueData.apps.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">
                        {String(queueData.nameMap.get(`startup:${row.startupId}`) || row.startupId)}
                      </td>
                      <td>
                        {String(queueData.nameMap.get(`programme:${row.programmeId}`) || row.programmeId)}
                      </td>
                      <td className="font-mono text-lattice-electric">
                        {row.aiFitScore != null ? String(row.aiFitScore) : "-"}
                      </td>
                      <td>{String(row.status)}</td>
                      <td>
                        <Link
                          href={`/programme/${row.programmeId}/applications`}
                          className="text-lattice-electric hover:underline"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {queueData.recs.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">
                        {String(queueData.nameMap.get(`startup:${row.sourceEntityId}`) || row.sourceEntityId)}
                      </td>
                      <td>
                        {String(
                          queueData.nameMap.get(`contributor:${row.targetEntityId}`) || row.targetEntityId,
                        )}
                      </td>
                      <td className="font-mono text-lattice-electric">
                        {row.matchScore != null ? String(row.matchScore) : "-"}
                      </td>
                      <td>Match review</td>
                      <td>
                        <Link
                          href={`/programme/${row.programmeId}/matches?rec=${row.id}`}
                          className="text-lattice-electric hover:underline"
                        >
                          Review XAI
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {queueStats && (
            <SignalBars
              title="Queue composition"
              subtitle="Relative pressure between application reviews and mentor approvals."
              items={[
                {
                  label: "Application queue",
                  value: queueStats.applications,
                  max: Math.max(1, queueStats.applications + queueStats.recommendations),
                  note: "Programme intake decisions.",
                  tone: "warning",
                },
                {
                  label: "Recommendation queue",
                  value: queueStats.recommendations,
                  max: Math.max(1, queueStats.applications + queueStats.recommendations),
                  note: "Mentor relationship approvals.",
                  tone: "accent",
                },
              ]}
            />
          )}

          <NarrativePanel title="Governance posture" eyebrow="Org admin">
            <p>
              Use the organisation view to balance speed and quality. A queue dominated by startup
              applications usually means the programme pipeline needs more reviewers; a queue
              dominated by mentor matches usually means the cohort is moving, but approval ops are
              lagging behind recommendation generation.
            </p>
            <p className="mt-3">
              The strongest pattern is a steady application flow with a smaller, higher-confidence
              mentor queue. That means the programme team is using AI as a filter, not as a source
              of extra noise.
            </p>
          </NarrativePanel>
        </div>
      </div>
    </SectionFrame>
  );
}
