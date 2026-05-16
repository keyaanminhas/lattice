"use client";

import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { contributorNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import {
  listContributorPoolAssignments,
  getProgramme,
  type DocRow,
} from "@/lib/data/firestoreQueries";

export default function ContributorAssignmentsPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const rows = useAsync(async () => {
    const pools = await listContributorPoolAssignments(entityId);
    return Promise.all(
      pools.map(async (p) => {
        const prog = p.programmeId ? await getProgramme(String(p.programmeId)) : null;
        return { ...p, programmeName: prog?.name || p.programmeId } as DocRow & {
          programmeName: string;
        };
      }),
    );
  }, [entityId]);

  return (
    <SectionFrame
      title="Programme assignments"
      subtitle="Pool memberships & invites"
      nav={contributorNav(entityId)}
    >
      <DataState
        loading={rows.loading}
        error={rows.error}
        empty={!rows.data?.length}
        onRetry={rows.reload}
      />
      {rows.data && rows.data.length > 0 && (
        <table className="lattice-data-grid lattice-panel overflow-auto">
          <thead>
            <tr>
              <th>Programme</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.data.map((r) => (
              <tr key={r.id}>
                <td>{String(r.programmeName)}</td>
                <td>{String(r.contributorType || "—")}</td>
                <td>{String(r.status || "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionFrame>
  );
}
