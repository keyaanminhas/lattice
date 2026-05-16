"use client";

import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { programmeNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import {
  listProgrammePool,
  getContributor,
  type DocRow,
} from "@/lib/data/firestoreQueries";

export default function ProgrammePoolPage() {
  const { programmeId } = useParams<{ programmeId: string }>();
  const pool = useAsync(async () => {
    const rows = await listProgrammePool(programmeId);
    return Promise.all(
      rows.map(async (p) => {
        const c = p.contributorId ? await getContributor(String(p.contributorId)) : null;
        return { ...p, contributorName: c?.name || p.contributorId } as DocRow & {
          contributorName: string;
        };
      }),
    );
  }, [programmeId]);

  return (
    <SectionFrame
      title="Contributor pool"
      subtitle="Mentors and partners attached to this programme"
      nav={programmeNav(programmeId)}
    >
      <DataState
        loading={pool.loading}
        error={pool.error}
        empty={!pool.data?.length}
        onRetry={pool.reload}
      />
      {pool.data && pool.data.length > 0 && (
        <div className="lattice-panel overflow-auto">
          <table className="lattice-data-grid">
            <thead>
              <tr>
                <th>Contributor</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pool.data.map((p) => (
                <tr key={p.id}>
                  <td>{String(p.contributorName)}</td>
                  <td>{String(p.contributorType || "—")}</td>
                  <td>{String(p.status || "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionFrame>
  );
}
