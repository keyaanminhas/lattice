"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { startupNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { useOnDemand } from "@/hooks/useOnDemand";
import { PageIntro } from "@/components/ui/PageIntro";
import { AiButton } from "@/components/ui/AiButton";
import {
  recommendProgrammesForStartup,
  applyToProgramme,
  runAiMatchPreview,
} from "@/lib/api/rbac";
import { listProgrammesByOrg } from "@/lib/data/firestoreQueries";
export default function StartupProgrammesPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const catalogue = useAsync(
    () => listProgrammesByOrg("org-sginnovate"),
    [],
  );
  const recs = useOnDemand(
    useCallback(() => recommendProgrammesForStartup(entityId), [entityId]),
  );

  async function apply(programmeId: string) {
    await applyToProgramme(entityId, programmeId);
    alert("Application submitted");
  }

  async function previewFit(programmeId: string, programmeName: string) {
    try {
      const res = await runAiMatchPreview(entityId, programmeId);
      const score = res.fit?.matchScore ?? "—";
      const explanation = res.fit?.explanation ?? "No explanation returned.";
      alert(`${programmeName}\nFit score: ${score}\n\n${explanation}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Preview failed");
    }
  }

  return (
    <SectionFrame
      title="Programme discovery"
      subtitle="Browse open programmes; run AI match only when needed"
      nav={startupNav(entityId)}
    >
      <PageIntro>
        Browse programmes open to your sector and stage. Apply directly from the catalogue, or run
        AI programme matching when you want Graph RAG recommendations with explanations.
      </PageIntro>
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-lattice-navy">Open programmes</h2>
        <DataState
          loading={catalogue.loading}
          error={catalogue.error}
          empty={!catalogue.data?.length}
          onRetry={catalogue.reload}
        />
        {catalogue.data && (
          <ul className="mt-3 space-y-2">
            {catalogue.data.map((p) => (
              <li key={p.id} className="lattice-panel flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-semibold">{String(p.name)}</p>
                  <p className="text-xs text-lattice-deep/60">{String(p.status)}</p>
                </div>
                <div className="flex gap-2">
                  <AiButton
                    variant="ghost"
                    className="!px-2 !py-1"
                    onClick={() => previewFit(String(p.id), String(p.name))}
                  >
                    AI fit preview
                  </AiButton>
                  <button
                    type="button"
                    className="lattice-btn-primary text-xs"
                    onClick={() => apply(String(p.id))}
                  >
                    Apply
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-lattice-navy">AI programme match</h2>
        <p className="mt-1 text-xs text-lattice-deep/60">
          Uses Graph RAG + Gemini only when you request it.
        </p>
        <AiButton variant="primary" className="mt-3" disabled={recs.loading} onClick={() => recs.run()}>
          {recs.loading ? "Matching…" : "Run AI programme match"}
        </AiButton>
        <DataState
          loading={recs.loading}
          error={recs.error}
          empty={recs.data !== null && !recs.data?.recommendations?.length}
          onRetry={() => recs.run()}
        />
        {recs.data?.recommendations && (
          <ul className="mt-3 space-y-3">
            {recs.data.recommendations.map((r) => (
              <li key={String(r.id)} className="lattice-panel p-4 text-sm">
                <p className="font-semibold">{String(r.targetEntityId)}</p>
                <p className="font-mono text-xs text-lattice-electric">
                  Score {String(r.matchScore)}
                </p>
                <p className="mt-1 text-xs text-lattice-deep/70">{String(r.explanation || "")}</p>
                <button
                  type="button"
                  className="lattice-btn-primary mt-3 text-xs"
                  onClick={() => apply(String(r.targetEntityId))}
                >
                  Apply
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SectionFrame>
  );
}
