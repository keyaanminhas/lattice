"use client";

import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { orgNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { listContributorsByOrg } from "@/lib/data/firestoreQueries";

export default function OrgContributorsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const contributors = useAsync(() => listContributorsByOrg(orgId), [orgId]);

  return (
    <SectionFrame title="Contributors" subtitle="Mentors, partners, investors" nav={orgNav(orgId)}>
      <DataState
        loading={contributors.loading}
        error={contributors.error}
        empty={!contributors.data?.length}
        onRetry={contributors.reload}
      />
      {contributors.data && contributors.data.length > 0 && (
        <div className="lattice-panel overflow-auto">
          <table className="lattice-data-grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Availability</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contributors.data.map((c) => (
                <tr key={c.id}>
                  <td>{String(c.name)}</td>
                  <td>{String(c.role || "—")}</td>
                  <td>{String(c.availability || "—")}</td>
                  <td>{String(c.status || c.verificationStatus || "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionFrame>
  );
}
