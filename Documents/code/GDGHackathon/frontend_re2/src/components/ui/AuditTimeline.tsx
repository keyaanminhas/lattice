import type { DocRow } from "@/lib/data/firestoreQueries";

function formatAction(action: string) {
  return action.replace(/\./g, " · ").replace(/_/g, " ");
}

export function AuditTimeline({ entries }: { entries: DocRow[] }) {
  if (!entries.length) {
    return (
      <p className="text-sm text-lattice-deep/60">No audit events recorded yet.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {entries.map((e) => (
        <li
          key={e.id}
          className="rounded-lg border border-lattice-border bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-lattice-navy">
              {formatAction(String(e.action ?? "activity"))}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-lattice-deep/50">
              {String(e.actorRole ?? "system")}
            </span>
          </div>
          <p className="mt-1 text-xs text-lattice-deep/70">
            {String(e.targetType ?? "resource")} · {String(e.targetId ?? "—")}
          </p>
          {e.metadata != null && typeof e.metadata === "object" && !Array.isArray(e.metadata) && (
            <p className="mt-2 text-xs leading-relaxed text-lattice-deep/60">
              {Object.entries(e.metadata as Record<string, unknown>)
                .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1")}: ${v}`)
                .join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
