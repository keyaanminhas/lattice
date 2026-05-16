"use client";

import type { ReactNode } from "react";

/** Explainable AI side-sheet: Graph RAG + embedding scores for mentor match review */

export interface MatchReviewData {
  recommendationId: string;
  startupName: string;
  mentorName: string;
  matchScore: number;
  scoreBreakdown: {
    semanticScore: number;
    ruleScore: number;
    graphScore: number;
    finalScore: number;
  };
  graphEvidence: {
    summary?: string;
    edges?: string[];
    pastOutcomeSignals?: string[];
    riskFlags?: string[];
  };
  explanation?: string;
}

export function MatchReviewPanel({
  data,
  onApprove,
  onReject,
  extraActions,
}: {
  data: MatchReviewData;
  onApprove: () => void;
  onReject: () => void;
  extraActions?: ReactNode;
}) {
  const bars = [
    { label: "Semantic (embeddings)", value: data.scoreBreakdown.semanticScore, max: 100 },
    { label: "Rule fit", value: data.scoreBreakdown.ruleScore, max: 40 },
    { label: "Graph RAG", value: data.scoreBreakdown.graphScore, max: 20 },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-lattice-border px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-lattice-electric">
          Explainable AI · Match review
        </p>
        <h2 className="mt-1 text-sm font-semibold text-lattice-navy">
          {data.startupName} → {data.mentorName}
        </h2>
        <p className="mt-1 font-mono text-2xl font-semibold text-lattice-primary">
          {data.matchScore}
          <span className="text-xs font-normal text-lattice-deep/50"> / 100</span>
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        <section>
          <h3 className="mb-2 font-semibold uppercase tracking-wide text-lattice-deep/70">
            Score decomposition
          </h3>
          {bars.map((b) => (
            <div key={b.label} className="mb-2">
              <div className="mb-0.5 flex justify-between">
                <span>{b.label}</span>
                <span className="font-mono">{b.value}</span>
              </div>
              <div className="h-1.5 rounded bg-lattice-muted">
                <div
                  className="h-full rounded bg-gradient-to-r from-lattice-primary to-lattice-electric"
                  style={{ width: `${Math.min(100, (b.value / b.max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="lattice-panel p-3">
          <h3 className="mb-2 font-semibold text-lattice-navy">Graph RAG evidence</h3>
          <p className="text-lattice-deep/80">{data.graphEvidence.summary}</p>
          <ul className="mt-2 space-y-1 font-mono text-[10px] text-lattice-electric">
            {(data.graphEvidence.edges || []).map((e) => (
              <li key={e}>⟶ {e}</li>
            ))}
          </ul>
        </section>

        {data.explanation && (
          <section>
            <h3 className="mb-1 font-semibold text-lattice-navy">Narrative</h3>
            <p className="leading-relaxed text-lattice-deep/80">{data.explanation}</p>
          </section>
        )}

        {(data.graphEvidence.riskFlags || []).length > 0 && (
          <section className="rounded border border-amber-200 bg-amber-50 p-3">
            <h3 className="font-semibold text-amber-900">Risk flags</h3>
            <ul className="mt-1 list-disc pl-4 text-amber-900/90">
              {data.graphEvidence.riskFlags!.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="space-y-2 border-t border-lattice-border p-4">
        {extraActions}
        <div className="flex gap-2">
          <button type="button" className="lattice-btn-primary flex-1" onClick={onApprove}>
            Approve match
          </button>
          <button type="button" className="lattice-btn-ghost flex-1" onClick={onReject}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}



