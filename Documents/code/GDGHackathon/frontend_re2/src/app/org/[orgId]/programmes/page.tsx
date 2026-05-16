"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { orgNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { listProgrammesByOrg } from "@/lib/data/firestoreQueries";

export default function OrgProgrammesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const programmes = useAsync(() => listProgrammesByOrg(orgId), [orgId]);

  return (
    <SectionFrame title="Programmes" subtitle="Org portfolio" nav={orgNav(orgId)}>
      <DataState
        loading={programmes.loading}
        error={programmes.error}
        empty={!programmes.data?.length}
        onRetry={programmes.reload}
      />
      {programmes.data && programmes.data.length > 0 && (
        <div className="lattice-panel overflow-auto">
          <table className="lattice-data-grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {programmes.data.map((p) => (
                <tr key={p.id}>
                  <td>{String(p.name)}</td>
                  <td>{String(p.type || "—")}</td>
                  <td>{String(p.status || "—")}</td>
                  <td>
                    <Link
                      href={`/programme/${p.id}`}
                      className="text-lattice-electric hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionFrame>
  );
}
