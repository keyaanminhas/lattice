import type { ReactNode } from "react";

export function PlaceholderPanel({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="lattice-panel p-6">
      <h2 className="text-sm font-semibold text-lattice-navy">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-lattice-deep/75">{description}</p>
      {actions && <div className="mt-4">{actions}</div>}
    </div>
  );
}
