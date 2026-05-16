import { labelGraphCountKey } from "@/lib/format/dashboardLabels";
import { InsightList, normaliseInsights } from "@/components/ui/InsightList";

type GraphView = {
  programme?: { name?: string; status?: string };
  counts?: Record<string, number>;
  graphEvidence?: { edges?: string[]; acceptedStartups?: number; poolSize?: number };
  graphInsights?: unknown;
};

export function ProgrammeGraphPanel({ data }: { data: GraphView }) {
  const programme = data.programme;
  const counts = data.counts ?? {};
  const evidence = data.graphEvidence;

  return (
    <div className="space-y-4">
      {programme && (
        <p className="text-sm leading-relaxed text-lattice-deep/80">
          <span className="font-semibold text-lattice-navy">
            {String(programme.name ?? "Programme")}
          </span>
          {programme.status ? (
            <span className="ml-2 rounded-full bg-lattice-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-lattice-deep/60">
              {String(programme.status)}
            </span>
          ) : null}
          {" — "}
          This subgraph shows how startups, mentors, and applications connect inside the programme
          graph used for explainable matching.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(counts).map(([key, value]) => (
          <div
            key={key}
            className="rounded-lg border border-lattice-border bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-[11px] font-medium text-lattice-deep/65">{labelGraphCountKey(key)}</p>
            <p className="mt-1 text-xl font-semibold text-lattice-navy">{value}</p>
          </div>
        ))}
      </div>

      {evidence && (
        <div className="lattice-panel p-5">
          <h3 className="text-sm font-semibold text-lattice-navy">Graph evidence</h3>
          <ul className="mt-3 space-y-2 text-sm text-lattice-deep/80">
            {evidence.acceptedStartups != null && (
              <li>
                <span className="font-medium text-lattice-navy">Cohort size:</span>{" "}
                {evidence.acceptedStartups} accepted startup
                {evidence.acceptedStartups === 1 ? "" : "s"}
              </li>
            )}
            {evidence.poolSize != null && (
              <li>
                <span className="font-medium text-lattice-navy">Contributor pool:</span>{" "}
                {evidence.poolSize} approved assignment
                {evidence.poolSize === 1 ? "" : "s"}
              </li>
            )}
            {evidence.edges && evidence.edges.length > 0 ? (
              <li>
                <span className="font-medium text-lattice-navy">Sample edges:</span>
                <ul className="mt-1 list-inside list-disc text-xs text-lattice-deep/70">
                  {evidence.edges.map((edge) => (
                    <li key={edge}>{edge.replace(/_/g, " ").replace(/->/g, " → ")}</li>
                  ))}
                </ul>
              </li>
            ) : (
              <li className="text-lattice-deep/60">No materialised edges yet — run graph rebuild if needed.</li>
            )}
          </ul>
        </div>
      )}

      {data.graphInsights != null && (
        <div className="lattice-panel p-5">
          <h3 className="text-sm font-semibold text-lattice-navy">Operational insights</h3>
          <div className="mt-3">
            <InsightList items={normaliseInsights(data.graphInsights)} />
          </div>
        </div>
      )}
    </div>
  );
}
