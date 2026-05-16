export type LatticeInsight = {
  type?: string;
  title: string;
  description: string;
  severity?: string;
};

export function InsightList({ items }: { items: LatticeInsight[] }) {
  if (!items.length) {
    return <p className="text-sm text-lattice-deep/60">No insights available.</p>;
  }

  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li
          key={`${item.type || "insight"}-${item.title}`}
          className="rounded border border-lattice-border p-3 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <strong className="text-lattice-navy">{item.title}</strong>
            {item.severity && (
              <span className="font-mono text-[10px] uppercase text-lattice-electric">
                {item.severity}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-lattice-deep/75">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function normaliseInsights(
  raw: unknown,
): LatticeInsight[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (typeof item === "string") {
        return { title: "Insight", description: item };
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return {
          type: o.type != null ? String(o.type) : undefined,
          title: String(o.title || o.type || "Insight"),
          description: String(o.description || ""),
          severity: o.severity != null ? String(o.severity) : undefined,
        };
      }
      return { title: "Insight", description: String(item) };
    });
  }
  if (typeof raw === "string") {
    return [{ title: "Summary", description: raw }];
  }
  return [];
}
