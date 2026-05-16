"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { programmeNav } from "@/lib/nav/menus";
import { MatchReviewPanel, type MatchReviewData } from "@/components/xai/MatchReviewPanel";
import { DataState } from "@/components/ui/DataState";
import { AiButton } from "@/components/ui/AiButton";
import { PageIntro } from "@/components/ui/PageIntro";
import { useAsync } from "@/hooks/useAsync";
import {
  getContributor,
  getStartup,
  listPendingMentorRecommendations,
} from "@/lib/data/firestoreQueries";
import { reviewMentorRelationship } from "@/lib/api/rbac";
import { AI_MATCH_APPROVE_SCORE, aiAutoApproveMatches } from "@/lib/ai/autoReview";

function toMatchReview(
  rec: Record<string, unknown>,
  startupName: string,
  mentorName: string,
): MatchReviewData {
  const breakdown = (rec.scoreBreakdown as Record<string, number>) || {};
  const graph = (rec.graphEvidence as Record<string, unknown>) || {};
  return {
    recommendationId: String(rec.id),
    startupName,
    mentorName,
    matchScore: Number(rec.matchScore || 0),
    scoreBreakdown: {
      semanticScore: breakdown.semanticScore ?? 0,
      ruleScore: breakdown.ruleScore ?? 0,
      graphScore: breakdown.graphScore ?? 0,
      finalScore: breakdown.finalScore ?? Number(rec.matchScore || 0),
    },
    graphEvidence: {
      summary: String(graph.summary || ""),
      edges: Array.isArray(graph.edges) ? (graph.edges as string[]) : [],
      riskFlags: Array.isArray(rec.riskFlags) ? (rec.riskFlags as string[]) : [],
    },
    explanation: String(rec.explanation || ""),
  };
}

export function MatchesClient({ programmeId }: { programmeId: string }) {
  const searchParams = useSearchParams();
  const recFromUrl = searchParams.get("rec");
  const [autoRunning, setAutoRunning] = useState(false);

  const recs = useAsync(async () => {
    const rows = await listPendingMentorRecommendations(programmeId);
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const startup = r.sourceEntityId
          ? await getStartup(String(r.sourceEntityId))
          : null;
        const mentor = r.targetEntityId
          ? await getContributor(String(r.targetEntityId))
          : null;
        return toMatchReview(
          r,
          String(startup?.name || r.sourceEntityId),
          String(mentor?.name || r.targetEntityId),
        );
      }),
    );
    return enriched;
  }, [programmeId]);

  const [selectedId, setSelectedId] = useState<string | null>(recFromUrl);

  const selected = useMemo(() => {
    if (!recs.data?.length) return null;
    const id = selectedId || recs.data[0]?.recommendationId;
    return recs.data.find((r) => r.recommendationId === id) || recs.data[0];
  }, [recs.data, selectedId]);

  const eligibleCount =
    recs.data?.filter((m) => m.matchScore >= AI_MATCH_APPROVE_SCORE).length ?? 0;

  async function approve() {
    if (!selected) return;
    await reviewMentorRelationship(programmeId, selected.recommendationId, "Approved");
    recs.reload();
  }

  async function reject() {
    if (!selected) return;
    await reviewMentorRelationship(programmeId, selected.recommendationId, "Rejected");
    recs.reload();
  }

  async function aiApproveSelected() {
    if (!selected) return;
    if (selected.matchScore < AI_MATCH_APPROVE_SCORE) {
      const ok = window.confirm(
        `Match score ${selected.matchScore} is below threshold ${AI_MATCH_APPROVE_SCORE}. Approve anyway?`,
      );
      if (!ok) return;
    }
    await approve();
  }

  async function runAutoApprove() {
    if (!recs.data?.length) return;
    const ok = window.confirm(
      `AI auto-approve will approve up to ${eligibleCount} match(es) with score ≥ ${AI_MATCH_APPROVE_SCORE}. Continue?`,
    );
    if (!ok) return;
    setAutoRunning(true);
    try {
      const { approved, skipped } = await aiAutoApproveMatches(
        programmeId,
        recs.data.map((m) => ({
          recommendationId: m.recommendationId,
          matchScore: m.matchScore,
        })),
      );
      alert(`AI auto-approve: ${approved} approved, ${skipped} skipped.`);
      recs.reload();
    } finally {
      setAutoRunning(false);
    }
  }

  return (
    <SectionFrame
      title="Match review queue"
      subtitle="Explainable AI · Startup-to-Mentor"
      nav={programmeNav(programmeId)}
      sideSheet={
        selected ? (
          <MatchReviewPanel
            data={selected}
            onApprove={approve}
            onReject={reject}
            extraActions={
              <AiButton variant="primary" className="w-full justify-center" onClick={aiApproveSelected}>
                AI approve this match
              </AiButton>
            }
          />
        ) : undefined
      }
    >
      <PageIntro>
        Review mentor matches with full score breakdown and graph evidence. Use AI auto-approve for
        high-confidence pairs, or inspect each match in the side panel before deciding.
      </PageIntro>

      {recs.data && recs.data.length > 0 && (
        <div className="mb-4">
          <AiButton
            variant="primary"
            disabled={autoRunning || eligibleCount === 0}
            onClick={runAutoApprove}
          >
            {autoRunning
              ? "Auto-approving…"
              : `AI auto-approve eligible matches (${eligibleCount})`}
          </AiButton>
        </div>
      )}

      <DataState
        loading={recs.loading}
        error={recs.error}
        empty={!recs.data?.length}
        onRetry={recs.reload}
      />
      {recs.data && recs.data.length > 0 && (
        <section className="flex flex-1 gap-4 p-4">
          <article className="lattice-panel flex-[2] overflow-auto p-4">
            <h2 className="text-xs font-semibold uppercase text-lattice-deep/60">
              Pending approval ({recs.data.length})
            </h2>
            <ul className="mt-3 space-y-2">
              {recs.data.map((m) => (
                <li key={m.recommendationId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.recommendationId)}
                    className={`w-full rounded border p-4 text-left ${
                      selected?.recommendationId === m.recommendationId
                        ? "border-2 border-lattice-electric bg-lattice-electric/5"
                        : "border-lattice-border hover:bg-lattice-muted"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {m.startupName} ↔ {m.mentorName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-lattice-electric">
                      Score {m.matchScore}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}
      {!recs.loading && !recs.error && recs.data?.length === 0 && (
        <p className="p-6 text-sm text-lattice-deep/70">
          No pending mentor matches. Accept a startup into the cohort, ensure mentors are in the
          pool, then run AI mentor match from the programme dashboard.
        </p>
      )}
    </SectionFrame>
  );
}
