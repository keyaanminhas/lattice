import type { ReactNode } from "react";

export function NarrativePanel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="lattice-panel relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lattice-electric/60 to-transparent" />
      {eyebrow && (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lattice-deep/45">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-1 text-sm font-semibold text-lattice-navy">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-lattice-deep/78">{children}</div>
    </section>
  );
}
