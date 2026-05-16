"use client";

import Link from "next/link";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatsGrid } from "@/components/ui/StatsGrid";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { NarrativePanel } from "@/components/ui/NarrativePanel";
import { SignalBars } from "@/components/ui/SignalBars";
import { platformNav, PRIMARY_LINKS } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { useOnDemand } from "@/hooks/useOnDemand";
import { getAiInsights, getDashboardStats } from "@/lib/api/rbac";
import { InsightList, normaliseInsights } from "@/components/ui/InsightList";

export default function PlatformAdminPage() {
  const stats = useAsync(() => getDashboardStats(), []);
  const insights = useOnDemand(() => getAiInsights());
  const statData = (stats.data as Record<string, number> | undefined) ?? undefined;

  const headlineStats = statData
    ? [
        {
          label: "Open programmes",
          value: statData.openProgrammes ?? 0,
          detail: "Live opportunities currently accepting startups or running active cohorts.",
          tone: "accent" as const,
        },
        {
          label: "Pending decisions",
          value: (statData.pendingApplications ?? 0) + (statData.pendingRecommendations ?? 0),
          detail: "Combined application and recommendation queue across the full network.",
          tone: "warning" as const,
        },
        {
          label: "Verified startup ratio",
          value: `${Math.round(
            ((statData.verifiedStartups ?? 0) / Math.max(1, statData.totalStartups ?? 0)) * 100,
          )}%`,
          detail: "Share of startup profiles ready for high-confidence matching.",
        },
        {
          label: "Outcome success",
          value: `${statData.successRate ?? 0}%`,
          detail: "Recorded positive outcomes across completed relationships.",
        },
      ]
    : [];

  const pipelineSignals = statData
    ? [
        {
          label: "Application review load",
          value: statData.pendingApplications ?? 0,
          max: Math.max(1, (statData.pendingApplications ?? 0) + (statData.acceptedApplications ?? 0)),
          note: "Pending versus processed applications.",
          tone: "warning" as const,
        },
        {
          label: "Recommendation backlog",
          value: statData.pendingRecommendations ?? 0,
          max: Math.max(1, statData.pendingRecommendations ?? 0, statData.activeRelationships ?? 0),
          note: "Match approvals waiting relative to active relationships.",
          tone: "accent" as const,
        },
        {
          label: "Contributor utilisation",
          value: statData.programmePoolAssignments ?? 0,
          max: Math.max(1, statData.totalContributors ?? 0),
          note: "Approved programme assignments versus total contributor supply.",
          tone: "success" as const,
        },
      ]
    : [];

  return (
    <SectionFrame
      title="Platform oversight"
      subtitle="Ecosystem health across tenants and programmes"
      nav={platformNav()}
    >
      <PageIntro>
        Monitor organisations, programmes, and matching pipelines across the Lattice network.
        Metrics refresh from live Firestore data. AI summaries run only when you request them,
        which keeps the global view informative without turning the control plane into a sparse
        reporting shell.
      </PageIntro>

      {headlineStats.length > 0 && <MetricStrip items={headlineStats} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="lattice-panel p-6">
          <h2 className="text-sm font-semibold text-lattice-navy">Ecosystem health</h2>
          <p className="mt-1 text-xs text-lattice-deep/60">
            Live counts across organisations, programmes, startups, contributors, and graph
            relationships.
          </p>
          <DataState loading={stats.loading} error={stats.error} onRetry={stats.reload} />
          {stats.data && (
            <div className="mt-4">
              <StatsGrid stats={stats.data as Record<string, unknown>} columns={2} />
            </div>
          )}
        </section>

        {pipelineSignals.length > 0 ? (
          <SignalBars
            title="Operational pulse"
            subtitle="A quick read on queue pressure, approval throughput, and coverage quality."
            items={pipelineSignals}
          />
        ) : (
          <section className="lattice-panel p-6">
            <DataState loading={stats.loading} error={stats.error} onRetry={stats.reload} />
          </section>
        )}

        <section className="lattice-panel p-6">
          <h2 className="text-sm font-semibold text-lattice-navy">AI insights</h2>
          <p className="mt-1 text-xs leading-relaxed text-lattice-deep/60">
            Gemini analyses platform-wide gaps in programme capacity, pending reviews, and graph
            coverage. Use this before weekly operations reviews or tenant escalation calls.
          </p>
          <button
            type="button"
            className="lattice-btn-ghost mt-3 text-xs"
            disabled={insights.loading}
            onClick={() => insights.run()}
          >
            {insights.loading ? "Generating..." : "Generate AI insights"}
          </button>
          <DataState
            loading={insights.loading}
            error={insights.error}
            empty={!insights.data && !insights.loading && !insights.error}
            onRetry={() => insights.run()}
          />
          {insights.data && (
            <div className="mt-4">
              <InsightList items={normaliseInsights(insights.data.insights)} />
            </div>
          )}
          {insights.data?.geminiError && (
            <p className="mt-2 text-xs text-amber-700">
              AI unavailable - {insights.data.geminiError}
            </p>
          )}
        </section>

        <NarrativePanel title="Operating notes" eyebrow="Control signal">
          <p>
            This view should read like a control room, not a placeholder dashboard. High pending
            decisions usually signal either thin programme admin capacity or recommendation
            thresholds that are too permissive and create avoidable review traffic.
          </p>
          <p className="mt-3">
            Healthy posture looks like a rising verified startup ratio, stable contributor pool
            utilisation, and a recommendation queue that remains smaller than the active
            relationship footprint.
          </p>
        </NarrativePanel>

        <section className="lattice-panel p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-lattice-navy">Primary workspaces</h2>
          <p className="mt-1 text-xs text-lattice-deep/60">
            Jump directly into the main SGInnovate tenant and flagship HealthTech programme.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Link
              className="rounded-2xl border border-lattice-border/80 bg-white/85 px-5 py-4 text-sm transition hover:border-lattice-electric/40 hover:bg-lattice-surface"
              href={`/org/${PRIMARY_LINKS.org}`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/45">
                Organisation workspace
              </span>
              <span className="mt-2 block text-lg font-semibold text-lattice-navy">SGInnovate</span>
              <span className="mt-1 block text-xs leading-relaxed text-lattice-deep/62">
                Review queue, programme oversight, contributor governance, and audit visibility.
              </span>
            </Link>
            <Link
              className="rounded-2xl border border-lattice-border/80 bg-white/85 px-5 py-4 text-sm transition hover:border-lattice-electric/40 hover:bg-lattice-surface"
              href={`/programme/${PRIMARY_LINKS.programme}`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/45">
                Programme workspace
              </span>
              <span className="mt-2 block text-lg font-semibold text-lattice-navy">
                HealthTech Catalyst 2026
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-lattice-deep/62">
                Cohort operations, mentor pool coverage, match reviews, and graph evidence.
              </span>
            </Link>
          </div>
        </section>
      </div>
    </SectionFrame>
  );
}
