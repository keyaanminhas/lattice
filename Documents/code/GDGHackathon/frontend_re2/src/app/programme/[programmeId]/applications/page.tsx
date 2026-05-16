"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { AiButton } from "@/components/ui/AiButton";
import { programmeNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import {
  listApplicationsForProgramme,
  getStartup,
  type DocRow,
} from "@/lib/data/firestoreQueries";
import { PageIntro } from "@/components/ui/PageIntro";
import { reviewApplication } from "@/lib/api/rbac";
import {
  AI_APPLICATION_APPROVE_SCORE,
  aiAutoApproveApplications,
} from "@/lib/ai/autoReview";

export default function ProgrammeApplicationsPage() {
  const { programmeId } = useParams<{ programmeId: string }>();
  const [autoRunning, setAutoRunning] = useState(false);
  const apps = useAsync(async () => {
    const rows = await listApplicationsForProgramme(programmeId);
    const enriched = await Promise.all(
      rows.map(async (a) => {
        const s = a.startupId ? await getStartup(String(a.startupId)) : null;
        return { ...a, startupName: s?.name || a.startupId } as DocRow & { startupName: string };
      }),
    );
    enriched.sort((a, b) => Number(b.aiFitScore || 0) - Number(a.aiFitScore || 0));
    return enriched;
  }, [programmeId]);

  const pendingCount =
    apps.data?.filter((a) => a.status === "Pending Admin Review").length ?? 0;
  const eligibleCount =
    apps.data?.filter(
      (a) =>
        a.status === "Pending Admin Review" &&
        Number(a.aiFitScore ?? 0) >= AI_APPLICATION_APPROVE_SCORE,
    ).length ?? 0;

  async function decide(applicationId: string, decision: "Accepted" | "Rejected") {
    await reviewApplication(programmeId, applicationId, decision);
    apps.reload();
  }

  async function aiAcceptOne(app: DocRow & { startupName: string }) {
    const score = Number(app.aiFitScore ?? 0);
    if (score < AI_APPLICATION_APPROVE_SCORE) {
      const ok = window.confirm(
        `Fit score ${score} is below the usual threshold (${AI_APPLICATION_APPROVE_SCORE}). Accept anyway?`,
      );
      if (!ok) return;
    }
    await decide(app.id, "Accepted");
  }

  async function runAutoApprove() {
    if (!apps.data?.length) return;
    const ok = window.confirm(
      `AI auto-approve will accept up to ${eligibleCount} pending application(s) with fit score ≥ ${AI_APPLICATION_APPROVE_SCORE}. Continue?`,
    );
    if (!ok) return;
    setAutoRunning(true);
    try {
      const { approved, skipped } = await aiAutoApproveApplications(programmeId, apps.data);
      alert(`AI auto-approve complete: ${approved} accepted, ${skipped} skipped.`);
      apps.reload();
    } finally {
      setAutoRunning(false);
    }
  }

  return (
    <SectionFrame
      title="Applications"
      subtitle="AI-ranked startup applications"
      nav={programmeNav(programmeId)}
    >
      <PageIntro>
        Applications are sorted by AI fit score. Use AI auto-approve to accept high-confidence
        candidates in one step, or review each row manually. Accepted startups appear on the
        relationship map and unlock mentor matching.
      </PageIntro>

      {pendingCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <AiButton
            variant="primary"
            disabled={autoRunning || eligibleCount === 0}
            onClick={runAutoApprove}
          >
            {autoRunning
              ? "Auto-approving…"
              : `AI auto-approve eligible (${eligibleCount})`}
          </AiButton>
          <span className="text-xs text-lattice-deep/55">
            Threshold: fit score ≥ {AI_APPLICATION_APPROVE_SCORE} · {pendingCount} pending
          </span>
        </div>
      )}

      <DataState
        loading={apps.loading}
        error={apps.error}
        empty={!apps.data?.length}
        onRetry={apps.reload}
      />
      {apps.data && apps.data.length > 0 && (
        <div className="lattice-panel overflow-auto">
          <table className="lattice-data-grid">
            <thead>
              <tr>
                <th>Startup</th>
                <th>Fit score</th>
                <th>Status</th>
                <th>AI rationale</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.data.map((a) => (
                <tr key={a.id}>
                  <td>{String(a.startupName)}</td>
                  <td className="font-mono text-lattice-electric">
                    {a.aiFitScore != null ? String(a.aiFitScore) : "—"}
                  </td>
                  <td>{String(a.status)}</td>
                  <td className="max-w-xs text-xs leading-relaxed text-lattice-deep/70">
                    {a.aiExplanation ? String(a.aiExplanation) : "—"}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    {a.status === "Pending Admin Review" && (
                      <>
                        <AiButton
                          variant="ghost"
                          className="!px-2 !py-1"
                          onClick={() => aiAcceptOne(a)}
                        >
                          AI accept
                        </AiButton>
                        <button
                          type="button"
                          className="text-xs text-lattice-electric hover:underline"
                          onClick={() => decide(a.id, "Accepted")}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => decide(a.id, "Rejected")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionFrame>
  );
}
