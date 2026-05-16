"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LatticeLogo } from "@/components/brand/LatticeLogo";
import { BackendStatus } from "@/components/layout/BackendStatus";
import { useAuth } from "@/context/AuthContext";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export function AppShell({
  title,
  subtitle,
  nav,
  children,
  sideSheet,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
  sideSheet?: ReactNode;
}) {
  const { signOut, claims } = useAuth();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(Boolean(sideSheet));
  const roleLabel = claims.role?.replace("_", " ") || "workspace";

  return (
    <div className="flex min-h-0 flex-1 bg-transparent">
      <aside className="flex w-64 shrink-0 flex-col border-r border-lattice-border/70 bg-white/85 backdrop-blur-sm">
        <div className="border-b border-lattice-border/70 px-5 py-5">
          <LatticeLogo />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-lattice-deep/55">
            {roleLabel}
          </p>
          <p className="mt-2 max-w-[180px] text-xs leading-relaxed text-lattice-deep/65">
            Operational workspace for live approvals, graph evidence, and role-scoped actions.
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "border border-lattice-electric/20 bg-gradient-to-r from-lattice-electric/10 to-white text-lattice-navy shadow-sm"
                    : "border border-transparent text-lattice-deep hover:border-lattice-border/80 hover:bg-lattice-muted/70"
                }`}
              >
                <span className="font-medium">{item.label}</span>
                {item.badge != null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                      active
                        ? "bg-lattice-electric text-white"
                        : "bg-lattice-electric/12 text-lattice-electric"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-lattice-border/70 p-4">
          <div className="rounded-2xl border border-lattice-border/80 bg-lattice-surface/70 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lattice-deep/55">
              Runtime
            </p>
            <p className="mt-1 text-xs leading-relaxed text-lattice-deep/70">
              Connected to the isolated RBAC backend and tenant-scoped data model.
            </p>
          </div>
          <BackendStatus />
          <button type="button" onClick={() => signOut()} className="lattice-btn-ghost mt-2 w-full">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between border-b border-lattice-border/70 bg-white/75 px-6 py-3 backdrop-blur-sm">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lattice-deep/45">
              Lattice control plane
            </p>
            <h1 className="mt-1 text-base font-semibold text-lattice-navy">{title}</h1>
            {subtitle && <p className="text-xs text-lattice-deep/60">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-lattice-border/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-lattice-deep/65 sm:block">
              Role-scoped workspace
            </div>
            {sideSheet && (
              <button
                type="button"
                className="lattice-btn-ghost"
                onClick={() => setSheetOpen((o) => !o)}
              >
                {sheetOpen ? "Close panel" : "Open review panel"}
              </button>
            )}
          </div>
        </header>
        <main className="flex flex-1 overflow-hidden">{children}</main>
      </div>

      {sideSheet && sheetOpen && (
        <aside className="w-[420px] shrink-0 border-l border-lattice-border/80 bg-white/95 shadow-panel backdrop-blur-sm">
          {sideSheet}
        </aside>
      )}
    </div>
  );
}



