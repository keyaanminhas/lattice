"use client";

import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { PlaceholderPanel } from "@/components/ui/PlaceholderPanel";
import { orgNav } from "@/lib/nav/menus";

export default function OrgAuditPage() {
  const { orgId } = useParams<{ orgId: string }>();

  return (
    <SectionFrame title="Audit log" subtitle={`Organisation ${orgId}`} nav={orgNav(orgId)}>
      <PlaceholderPanel
        title="Org-scoped audit"
        description="Filter audit_logs by orgId. Org admins see actions within their tenant."
      />
    </SectionFrame>
  );
}
