import type { ReactNode } from "react";

export function PageIntro({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 max-w-4xl rounded-2xl border border-white/80 bg-white/72 px-5 py-4 shadow-sm backdrop-blur-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/45">
        Operational brief
      </p>
      <p className="mt-2 text-sm leading-relaxed text-lattice-deep/78">{children}</p>
    </div>
  );
}
