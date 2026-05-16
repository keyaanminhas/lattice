"use client";

import type { ReactNode } from "react";
import { AppShell, type NavItem } from "./AppShell";

export function SectionFrame({
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
  return (
    <AppShell title={title} subtitle={subtitle} nav={nav} sideSheet={sideSheet}>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </AppShell>
  );
}
