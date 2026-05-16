"use client";

import { LOGIN_ACCOUNTS, LOGIN_PASSWORD } from "@/config/loginAccounts";

/** Dev/staging quick-login panel only — not shown in production unless enabled. */
export function DemoLoginPanel({
  onPick,
}: {
  onPick: (email: string, password: string) => void;
}) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS !== "true") {
    return null;
  }

  return (
    <div className="mt-6 rounded border border-dashed border-lattice-border bg-lattice-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-lattice-deep/60">
        Development logins
      </p>
      <p className="mt-1 font-mono text-[10px] text-lattice-deep/50">
        Password (all): {LOGIN_PASSWORD}
      </p>
      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
        {LOGIN_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-white"
              onClick={() => onPick(a.email, LOGIN_PASSWORD)}
            >
              <span className="block font-medium text-lattice-navy">{a.role}</span>
              <span className="block text-[10px] text-lattice-deep/70">{a.name}</span>
              <span className="font-mono text-[10px] text-lattice-deep/50">{a.email}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
