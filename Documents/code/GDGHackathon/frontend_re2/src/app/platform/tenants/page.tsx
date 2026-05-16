"use client";

import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { platformNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { listOrganisations } from "@/lib/data/firestoreQueries";

export default function PlatformTenantsPage() {
  const orgs = useAsync(() => listOrganisations(), []);

  return (
    <SectionFrame title="Tenants" subtitle="Organisations on Lattice" nav={platformNav()}>
      <DataState loading={orgs.loading} error={orgs.error} empty={!orgs.data?.length} onRetry={orgs.reload} />
      {orgs.data && orgs.data.length > 0 && (
        <div className="lattice-panel overflow-auto">
          <table className="lattice-data-grid">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Country</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orgs.data.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">{o.id}</td>
                  <td>{String(o.name)}</td>
                  <td>{String(o.country || "—")}</td>
                  <td>{String(o.status || "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionFrame>
  );
}
