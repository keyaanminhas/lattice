"use client";

import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { startupNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import {
  listApplicationsForStartup,
  getProgramme,
  type DocRow,
} from "@/lib/data/firestoreQueries";

export default function StartupApplicationsPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const apps = useAsync(async () => {
    const rows = await listApplicationsForStartup(entityId);
    return Promise.all(
      rows.map(async (a) => {
        const p = a.programmeId ? await getProgramme(String(a.programmeId)) : null;
        return { ...a, programmeName: p?.name || a.programmeId } as DocRow & {
          programmeName: string;
        };
      }),
    );
  }, [entityId]);

  return (
    <SectionFrame title="My applications" subtitle="Status & AI fit" nav={startupNav(entityId)}>
      <DataState
        loading={apps.loading}
        error={apps.error}
        empty={!apps.data?.length}
        onRetry={apps.reload}
      />
      {apps.data && apps.data.length > 0 && (
        <table className="lattice-data-grid lattice-panel overflow-auto">
          <thead>
            <tr>
              <th>Programme</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {apps.data.map((a) => (
              <tr key={a.id}>
                <td>{String(a.programmeName)}</td>
                <td className="font-mono text-lattice-electric">
                  {a.aiFitScore != null ? String(a.aiFitScore) : "—"}
                </td>
                <td>{String(a.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionFrame>
  );
}
