"use client";

import { AuthGuard } from "@/context/AuthContext";
import type { ReactNode } from "react";

export default function ContributorLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
