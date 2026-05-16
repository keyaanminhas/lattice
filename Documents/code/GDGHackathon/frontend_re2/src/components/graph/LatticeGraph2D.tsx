"use client";

import { useMemo, useState } from "react";
import type { GraphLink, GraphNode, GraphLinkKind } from "@/lib/data/graphBuilder";

const NODE_COLORS: Record<GraphNode["kind"], { fill: string; stroke: string }> = {
  programme: { fill: "#1e4d8c", stroke: "#0b1f3a" },
  startup: { fill: "#2b7bff", stroke: "#1e4d8c" },
  contributor: { fill: "#10b981", stroke: "#047857" },
};

const LINK_COLORS: Record<GraphLinkKind, string> = {
  applied: "#94a3b8",
  accepted: "#2b7bff",
  pool: "#10b981",
  match_pending: "#a855f7",
  match_active: "#7c3aed",
  graph: "#64748b",
};

function layoutNodes(nodes: GraphNode[], width: number, height: number) {
  const pad = 56;
  const cx = width / 2;
  const cy = height / 2;
  const positions = new Map<string, { x: number; y: number }>();

  const programme = nodes.find((n) => n.kind === "programme");
  const startups = nodes.filter((n) => n.kind === "startup");
  const contributors = nodes.filter((n) => n.kind === "contributor");

  if (programme) {
    positions.set(programme.id, { x: cx, y: cy });
  }

  const rStartup = Math.min(width, height) * 0.36;
  startups.forEach((n, i) => {
    const t = startups.length === 1 ? 0.5 : i / (startups.length - 1);
    const angle = Math.PI * 0.55 + t * Math.PI * 0.9;
    positions.set(n.id, {
      x: cx + Math.cos(angle) * rStartup,
      y: cy + Math.sin(angle) * rStartup * 0.85,
    });
  });

  const rContrib = Math.min(width, height) * 0.38;
  contributors.forEach((n, i) => {
    const t = contributors.length === 1 ? 0.5 : i / (contributors.length - 1);
    const angle = -Math.PI * 0.45 + t * Math.PI * 0.9;
    positions.set(n.id, {
      x: cx + Math.cos(angle) * rContrib,
      y: cy + Math.sin(angle) * rContrib * 0.85,
    });
  });

  nodes.forEach((n, i) => {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: pad + (i % 4) * 40, y: pad + Math.floor(i / 4) * 40 });
    }
  });

  return positions;
}

export function LatticeGraph2D({
  nodes,
  links,
  height = 420,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  height?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const width = 720;

  const positions = useMemo(() => layoutNodes(nodes, width, height), [nodes, width, height]);

  const hoveredNode = hovered?.startsWith("node:") ? hovered.slice(5) : null;
  const hoveredLink = hovered?.startsWith("link:") ? hovered.slice(5) : null;

  if (nodes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-lattice-border p-8 text-center text-sm text-lattice-deep/60">
        No graph nodes yet. Add applications or mentors to see relationships.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-lattice-border bg-gradient-to-b from-white to-lattice-surface/80">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[320px]"
          style={{ height }}
          role="img"
          aria-label="Programme relationship graph"
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
            </marker>
          </defs>

          {links.map((link) => {
            const a = positions.get(link.source);
            const b = positions.get(link.target);
            if (!a || !b) return null;
            const active = hoveredLink === link.id || hoveredNode === link.source || hoveredNode === link.target;
            const dashed = link.kind === "match_pending" || link.kind === "applied";
            return (
              <g key={link.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={LINK_COLORS[link.kind]}
                  strokeWidth={active ? 2.5 : 1.5}
                  strokeOpacity={active ? 1 : 0.55}
                  strokeDasharray={dashed ? "6 4" : undefined}
                  markerEnd={link.kind === "match_pending" ? undefined : "url(#arrow)"}
                  onMouseEnter={() => setHovered(`link:${link.id}`)}
                  onMouseLeave={() => setHovered(null)}
                />
                {!dashed && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 6}
                    textAnchor="middle"
                    className="fill-lattice-deep/50 text-[9px]"
                  >
                    {link.label}
                  </text>
                )}
              </g>
            );
          })}

          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const colors = NODE_COLORS[node.kind];
            const active = hoveredNode === node.id;
            const r = node.kind === "programme" ? 28 : 22;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHovered(`node:${node.id}`)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default" }}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={active ? r + 4 : r}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={active ? 3 : 2}
                  opacity={active ? 1 : 0.92}
                />
                <text
                  x={pos.x}
                  y={pos.y + r + 14}
                  textAnchor="middle"
                  className="fill-lattice-navy text-[10px] font-medium"
                >
                  {node.label.length > 18 ? `${node.label.slice(0, 16)}…` : node.label}
                </text>
                {node.subtitle && (
                  <text
                    x={pos.x}
                    y={pos.y + r + 26}
                    textAnchor="middle"
                    className="fill-lattice-deep/50 text-[8px]"
                  >
                    {node.subtitle}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-lattice-deep/65">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#1e4d8c]" /> Programme
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#2b7bff]" /> Startup
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#10b981]" /> Contributor
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-6 border-t-2 border-dashed border-violet-500" /> Pending match
        </span>
      </div>

      {hoveredLink && (
        <p className="text-xs text-lattice-deep/70">
          {links.find((l) => l.id === hoveredLink)?.label ?? "Relationship"}
        </p>
      )}
    </div>
  );
}
