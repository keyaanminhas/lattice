export type MetricStripItem = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "accent" | "warning";
};

const TONE_STYLES: Record<NonNullable<MetricStripItem["tone"]>, string> = {
  default: "border-lattice-border/80 bg-white/90",
  accent: "border-lattice-electric/20 bg-gradient-to-br from-lattice-electric/8 to-white",
  warning: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
};

export function MetricStrip({
  items,
  columns = 4,
}: {
  items: MetricStripItem[];
  columns?: 2 | 3 | 4;
}) {
  const colClass =
    columns === 4
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : columns === 3
        ? "sm:grid-cols-2 xl:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <div className={`grid gap-3 ${colClass}`}>
      {items.map((item) => (
        <article
          key={item.label}
          className={`lattice-kpi-card border ${TONE_STYLES[item.tone || "default"]}`}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-lattice-deep/55">
            {item.label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-lattice-navy">
            {item.value}
          </p>
          {item.detail && (
            <p className="mt-2 text-xs leading-relaxed text-lattice-deep/68">{item.detail}</p>
          )}
        </article>
      ))}
    </div>
  );
}
