"use client";

import { useAsync } from "@/hooks/useAsync";
import { listRbacActions } from "@/lib/api/rbac";

export function BackendStatus() {
  const { data, error, loading } = useAsync(() => listRbacActions(), []);

  if (loading) return null;
  if (error) {
    return (
      <p className="text-[10px] text-amber-700">
        rbacApi unreachable — check Firebase config and sign-in.
      </p>
    );
  }
  if (!data) return null;

  return (
    <p className="font-mono text-[10px] text-lattice-deep/50">
      {data.database} · {data.actions.length} actions · Graph RAG{" "}
      {data.graphRagEnabled ? "on" : "off"}
      {data.geminiSummariesEnabled ? " · Gemini" : ""}
    </p>
  );
}
