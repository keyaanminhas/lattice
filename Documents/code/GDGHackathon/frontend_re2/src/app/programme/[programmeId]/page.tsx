"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { PageIntro } from "@/components/ui/PageIntro";
import { ProgrammeGraphPanel } from "@/components/ui/ProgrammeGraphPanel";
import { ProgrammeGraphSection } from "@/components/graph/ProgrammeGraphSection";
import { AiButton } from "@/components/ui/AiButton";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { NarrativePanel } from "@/components/ui/NarrativePanel";
import { SignalBars } from "@/components/ui/SignalBars";
import { programmeNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { getProgrammeGraphView, recommendMentorForStartup } from "@/lib/api/rbac";
import { getProgramme, listApplicationsForProgramme, getStartup } from "@/lib/data/firestoreQueries";

export default function ProgrammeHomePage() {
  const { programmeId } = useParams<{ programmeId: string }>();
  const [matching, setMatching] = useState(false);
  const programme = useAsync(() => getProgramme(programmeId), [programmeId]);
  const graph = useAsync(() => getProgrammeGraphView(programmeId), [programmeId]);
  const cohort = useAsync(async () => {
    const apps = await listApplicationsForProgramme(programmeId);
    const accepted = apps.filter((a) => a.status === "Accepted");
    return Promise.all(
      accepted.map(async (a) => {
        const s = await getStartup(String(a.startupId));
        return {
          startupId: String(a.startupId),
          name: s ? String(s.name) : String(a.startupId),
        };
      }),
    );
  }, [programmeId]);

  async function runMentorMatch(startupId: string) {
    setMatching(true);
    try {
      const res = await recommendMentorForStartup(programmeId, startupId);
      alert(`Generated ${res.recommendations?.length ?? 0} mentor recommendations`);
    } finally {
      setMatching(false);
    }
  }

  async function runMentorMatchAll() {
    if (!cohort.data?.length) return;
    setMatching(true);
    try {
      let total = 0;
      for (const s of cohort.data) {
        const res = await recommendMentorForStartup(programmeId, s.startupId);
        total += res.recommendations?.length ?? 0;
      }
      alert(`AI mentor match complete: ${total} recommendation(s) generated.`);
    } finally {
      setMatching(false);
    }
  }

  const progName = programme.data ? String(programme.data.name) : "Programme";
  const graphCounts = (graph.data?.counts as Record<string, number> | undefined) ?? {};

  return (
    <SectionFrame title="Programme operations" subtitle={progName} nav={programmeNav(programmeId)}>
      <PageIntro>
        Run the {progName} cohort from one place: inspect graph health, monitor mentor supply,
        review accepted startups, and trigger explainable matching when the programme is ready. The
        home screen now acts more like an operating console than a sparse launch pad.
      </PageIntro>

      {(cohort.data || graph.data) && (
        <MetricStrip
          items={[
            {
              label: "Accepted cohort",
              value: cohort.data?.length ?? 0,
              detail: "Startups currently admitted and eligible for mentor workflows.",
              tone: "accent",
            },
            {
              label: "Pool contributors",
              value: graphCounts.attachedContributors ?? 0,
              detail: "Approved contributor assignments available to the programme.",
            },
            {
              label: "Active relationships",
              value: graphCounts.activeRelationships ?? 0,
              detail: "Live startup-contributor relationships being tracked right now.",
            },
            {
              label: "Graph edges",
              value: graphCounts.graphEdges ?? 0,
              detail: "Materialised edges supporting explainability and retrieval.",
            },
          ]}
        />
      )}

      <div className="mt-6 space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
          <ProgrammeGraphSection programmeId={programmeId} />

          {(cohort.data || graph.data) && (
            <div className="space-y-6">
              <SignalBars
                title="Programme readiness"
                subtitle="A simple visual read on whether the cohort and mentor pool are in balance."
                items={[
                  {
                    label: "Cohort admitted",
                    value: cohort.data?.length ?? 0,
                    max: Math.max(1, (graphCounts.acceptedStartups ?? 0) || cohort.data?.length || 1),
                    note: "Accepted startups in the current programme.",
                    tone: "accent",
                  },
                  {
                    label: "Mentor supply",
                    value: graphCounts.attachedContributors ?? 0,
                    max: Math.max(1, (cohort.data?.length ?? 0) * 2),
                    note: "Contributor pool relative to cohort size.",
                    tone: "success",
                  },
                  {
                    label: "Explainability depth",
                    value: graphCounts.graphEdges ?? 0,
                    max: Math.max(1, (graphCounts.acceptedStartups ?? 0) * 12),
                    note: "Graph density available for evidence-backed reviews.",
                  },
                ]}
              />

              <NarrativePanel title="Programme posture" eyebrow="Ops brief">
                <p>
                  Strong programme posture means accepted startups are visible, mentor supply is
                  broad enough to avoid repetitive matches, and the graph has enough materialised
                  edges to support explainable decisions instead of hand-wavy scores.
                </p>
                <p className="mt-3">
                  If the cohort is growing faster than contributor supply, prioritise pool
                  operations before generating another round of recommendations. If graph density is
                  low, rebuild graph state before using AI outputs as a decisive filter.
                </p>
              </NarrativePanel>
            </div>
          )}
        </div>

        {cohort.data && cohort.data.length > 0 && (
          <div className="rounded-2xl border border-lattice-border/80 bg-white/82 p-5 shadow-panel">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/45">
              Matching controls
            </p>
            <p className="mt-2 text-sm font-semibold text-lattice-navy">AI mentor matching</p>
            <p className="mt-1 text-xs leading-relaxed text-lattice-deep/62">
              Generate explainable Startup-to-Mentor recommendations for the accepted cohort. Run
              the full cohort batch when the pool is healthy, or trigger matching one startup at a
              time when you want to inspect output quality more carefully.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <AiButton variant="primary" disabled={matching} onClick={runMentorMatchAll}>
                {matching ? "Matching..." : "AI match all cohort startups"}
              </AiButton>
              {cohort.data.map((s) => (
                <AiButton
                  key={s.startupId}
                  variant="ghost"
                  disabled={matching}
                  onClick={() => runMentorMatch(s.startupId)}
                >
                  {s.name}
                </AiButton>
              ))}
            </div>
          </div>
        )}

        <DataState loading={graph.loading} error={graph.error} onRetry={graph.reload} />
        {graph.data && <ProgrammeGraphPanel data={graph.data} />}
      </div>
    </SectionFrame>
  );
}
