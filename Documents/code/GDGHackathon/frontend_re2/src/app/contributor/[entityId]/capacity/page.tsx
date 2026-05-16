"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { contributorNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { getContributor } from "@/lib/data/firestoreQueries";
import { updateContributorCapacity } from "@/lib/api/rbac";

export default function ContributorCapacityPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const profile = useAsync(() => getContributor(entityId), [entityId]);
  const [maxProg, setMaxProg] = useState(3);
  const [msg, setMsg] = useState("");

  async function save() {
    await updateContributorCapacity(entityId, {
      globalMaxProgrammes: maxProg,
      globalMaxStartupAssignments: 5,
    });
    setMsg("Capacity updated.");
    profile.reload();
  }

  return (
    <SectionFrame title="Capacity" subtitle="Availability & load" nav={contributorNav(entityId)}>
      <DataState loading={profile.loading} error={profile.error} onRetry={profile.reload} />
      {profile.data && (
        <section className="lattice-panel max-w-sm p-6 text-sm">
          <label className="block text-xs font-medium">
            Max programmes
            <input
              type="number"
              className="mt-1 w-full rounded border border-lattice-border px-2 py-1"
              value={maxProg}
              onChange={(e) => setMaxProg(Number(e.target.value))}
            />
          </label>
          <button type="button" className="lattice-btn-primary mt-4" onClick={save}>
            Save capacity
          </button>
          {msg && <p className="mt-2 text-xs text-lattice-electric">{msg}</p>}
        </section>
      )}
    </SectionFrame>
  );
}
