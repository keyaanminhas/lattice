"use client";

import { useAsync } from "@/hooks/useAsync";
import { buildProgrammeGraphData } from "@/lib/data/graphBuilder";
import { DataState } from "@/components/ui/DataState";
import { LatticeGraph2D } from "@/components/graph/LatticeGraph2D";

export function ProgrammeGraphSection({ programmeId }: { programmeId: string }) {
  const graph = useAsync(() => buildProgrammeGraphData(programmeId), [programmeId]);

  return (
    <section className="lattice-panel p-5">
      <h2 className="text-sm font-semibold text-lattice-navy">Relationship map</h2>
      <p className="mt-1 text-xs leading-relaxed text-lattice-deep/65">
        Live 2D view of startups, contributors, and programme links from applications, mentor pool,
        pending matches, and graph edges. Hover nodes and lines for detail.
      </p>
      <div className="mt-4">
        <DataState loading={graph.loading} error={graph.error} onRetry={graph.reload} />
      </div>
      {graph.data && (
        <div className="mt-4">
          <LatticeGraph2D nodes={graph.data.nodes} links={graph.data.links} />
          <p className="mt-2 text-[10px] text-lattice-deep/50">
            {graph.data.nodes.length} entities · {graph.data.links.length} relationships ·{" "}
            {graph.data.programmeName}
          </p>
        </div>
      )}
    </section>
  );
}
