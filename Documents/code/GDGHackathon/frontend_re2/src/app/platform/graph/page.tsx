"use client";

import { useCallback, useState } from "react";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { PageIntro } from "@/components/ui/PageIntro";
import { AiButton } from "@/components/ui/AiButton";
import { ProgrammeGraphPanel } from "@/components/ui/ProgrammeGraphPanel";
import { ProgrammeGraphSection } from "@/components/graph/ProgrammeGraphSection";
import { platformNav, PRIMARY_LINKS } from "@/lib/nav/menus";
import { useOnDemand } from "@/hooks/useOnDemand";
import { getProgrammeGraphView, rebuildGraphRag } from "@/lib/api/rbac";

export default function PlatformGraphPage() {
  const [rebuilding, setRebuilding] = useState(false);
  const graph = useOnDemand(
    useCallback(() => getProgrammeGraphView(PRIMARY_LINKS.programme), []),
  );

  async function runRebuild() {
    setRebuilding(true);
    try {
      await rebuildGraphRag(PRIMARY_LINKS.programme);
      alert("Graph edges rebuilt from operational data.");
      graph.run();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Rebuild failed");
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <SectionFrame
      title="LatticeGraph"
      subtitle="Programme subgraph for HealthTech Catalyst 2026"
      nav={platformNav()}
    >
      <PageIntro>
        Explore how startups, mentors, and programmes connect in a live 2D map built from your
        database. Load operational insights below, or rebuild graph edges from applications and
        pool assignments.
      </PageIntro>

      <div className="mb-6 flex flex-wrap gap-2">
        <AiButton
          variant="ghost"
          disabled={graph.loading}
          onClick={() => graph.run()}
        >
          {graph.loading ? "Loading…" : "Load graph insights"}
        </AiButton>
        <AiButton variant="ghost" disabled={rebuilding} onClick={runRebuild}>
          {rebuilding ? "Rebuilding…" : "Rebuild graph edges"}
        </AiButton>
      </div>

      <ProgrammeGraphSection programmeId={PRIMARY_LINKS.programme} />

      <div className="mt-6">
        <DataState
          loading={graph.loading}
          error={graph.error}
          empty={!graph.data && !graph.loading}
          onRetry={() => graph.run()}
        />
        {graph.data && <ProgrammeGraphPanel data={graph.data} />}
      </div>
    </SectionFrame>
  );
}
