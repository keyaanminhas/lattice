"use client";

import { motion } from "framer-motion";

const NODES = [
  { id: "p1", x: 50, y: 16, label: "Programme", metric: "Open intake" },
  { id: "s1", x: 20, y: 42, label: "Startup", metric: "Profile fit" },
  { id: "m1", x: 80, y: 40, label: "Mentor", metric: "Capacity" },
  { id: "o1", x: 50, y: 74, label: "Outcome", metric: "Learning loop" },
];

const EDGES = [
  ["s1", "p1"],
  ["m1", "p1"],
  ["s1", "m1"],
  ["p1", "o1"],
];

export function LatticeGraphHero() {
  const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-[#07182d] via-[#0d2748] to-[#194f87] p-5 shadow-panel">
      <div className="absolute inset-0 opacity-25">
        <div className="lattice-subtle-grid h-full w-full" />
      </div>

      <div className="absolute inset-x-5 top-5 flex items-center justify-between rounded-full border border-white/15 bg-white/8 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white/70">
        <span>Graph signal</span>
        <span>Live review plane</span>
      </div>

      <svg className="relative mt-10 h-[72%] w-full" viewBox="0 0 100 100">
        {EDGES.map(([a, b], i) => {
          const na = pos[a];
          const nb = pos[b];
          return (
            <motion.line
              key={i}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="#8EC5FF"
              strokeWidth="0.75"
              strokeOpacity="0.8"
              initial={{ pathLength: 0, opacity: 0.3 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: 1.15, delay: i * 0.15 }}
            />
          );
        })}

        {NODES.map((n, i) => (
          <g key={n.id}>
            <motion.circle
              cx={n.x}
              cy={n.y}
              r="4.4"
              fill="#2B7BFF"
              stroke="#CFE4FF"
              strokeWidth="0.55"
              initial={{ scale: 0.65, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.08 }}
            />
            <circle cx={n.x} cy={n.y} r="8.4" fill="rgba(77,163,255,0.1)" />
            <text x={n.x} y={n.y + 9} textAnchor="middle" className="fill-white text-[3px] font-medium">
              {n.label}
            </text>
            <text x={n.x} y={n.y + 13} textAnchor="middle" className="fill-white/60 text-[2px]">
              {n.metric}
            </text>
          </g>
        ))}
      </svg>

      <div className="absolute inset-x-5 bottom-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-3 backdrop-blur-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Scoring</p>
          <p className="mt-2 text-sm font-semibold text-white">Semantic + rule + graph</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-3 backdrop-blur-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Review</p>
          <p className="mt-2 text-sm font-semibold text-white">Approve with evidence</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-3 backdrop-blur-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Feedback</p>
          <p className="mt-2 text-sm font-semibold text-white">Outcome-driven learning</p>
        </div>
      </div>
    </div>
  );
}
