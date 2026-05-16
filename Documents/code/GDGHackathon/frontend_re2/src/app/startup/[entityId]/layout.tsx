"use client";

import { AuthGuard } from "@/context/AuthContext";
import type { ReactNode } from "react";

export default function StartupLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
