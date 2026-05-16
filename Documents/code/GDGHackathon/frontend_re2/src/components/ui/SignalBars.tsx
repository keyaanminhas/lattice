export type SignalBarItem = {
  label: string;
  value: number;
  max: number;
  note?: string;
  tone?: "default" | "accent" | "success" | "warning";
};

const BAR_TONES: Record<NonNullable<SignalBarItem["tone"]>, string> = {
  default: "from-lattice-primary/75 to-lattice-electric/85",
  accent: "from-lattice-primary to-lattice-electric",
  success: "from-emerald-500 to-teal-400",
  warning: "from-amber-500 to-orange-400",
};

export function SignalBars({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: SignalBarItem[];
}) {
  return (
    <section className="lattice-panel p-5">
      <h2 className="text-sm font-semibold text-lattice-navy">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-xs leading-relaxed text-lattice-deep/65">{subtitle}</p>
      )}

      <div className="mt-4 space-y-4">
        {items.map((item) => {
          const percentage =
            item.max > 0 ? Math.max(0, Math.min(100, (item.value / item.max) * 100)) : 0;
          return (
            <div key={item.label}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-lattice-navy">{item.label}</p>
                  {item.note && (
                    <p className="mt-0.5 text-[11px] text-lattice-deep/62">{item.note}</p>
                  )}
                </div>
                <p className="font-mono text-xs text-lattice-deep/55">
                  {item.value} / {item.max}
                </p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-lattice-muted">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${
                    BAR_TONES[item.tone || "default"]
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
