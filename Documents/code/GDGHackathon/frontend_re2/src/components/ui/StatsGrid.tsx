import { formatStatValue, labelStatKey } from "@/lib/format/dashboardLabels";

const HIGHLIGHT_KEYS = new Set([
  "pendingApplications",
  "pendingRecommendations",
  "openProgrammes",
  "successRate",
]);

export function StatsGrid({
  stats,
  columns = 2,
}: {
  stats: Record<string, unknown>;
  columns?: 2 | 3 | 4;
}) {
  const entries = Object.entries(stats).filter(
    ([k]) => k !== "programmeGapReports" && !k.startsWith("_"),
  );
  const colClass =
    columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <div className={`grid gap-3 ${colClass}`}>
      {entries.map(([key, value]) => (
        <div
          key={key}
          className={`rounded-lg border px-4 py-3 ${
            HIGHLIGHT_KEYS.has(key)
              ? "border-lattice-electric/30 bg-lattice-electric/5"
              : "border-lattice-border bg-lattice-surface/40"
          }`}
        >
          <p className="text-[11px] font-medium leading-snug text-lattice-deep/65">
            {labelStatKey(key)}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-lattice-navy">
            {formatStatValue(key, value)}
          </p>
        </div>
      ))}
    </div>
  );
}
