"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { contributorNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { getContributor } from "@/lib/data/firestoreQueries";
import { updateContributorProfile } from "@/lib/api/rbac";

export default function ContributorProfilePage() {
  const { entityId } = useParams<{ entityId: string }>();
  const profile = useAsync(() => getContributor(entityId), [entityId]);
  const [expertise, setExpertise] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    await updateContributorProfile(entityId, {
      expertise: expertise.split(",").map((s) => s.trim()).filter(Boolean),
    });
    setMsg("Profile updated.");
    profile.reload();
  }

  return (
    <SectionFrame title="Contributor profile" subtitle="Expertise & bio" nav={contributorNav(entityId)}>
      <DataState loading={profile.loading} error={profile.error} onRetry={profile.reload} />
      {profile.data && (
        <section className="lattice-panel max-w-xl p-6 text-sm">
          <label className="block text-xs font-medium">
            Expertise (comma-separated)
            <input
              className="mt-1 w-full rounded border border-lattice-border px-2 py-1"
              defaultValue={
                Array.isArray(profile.data.expertise)
                  ? (profile.data.expertise as string[]).join(", ")
                  : ""
              }
              onChange={(e) => setExpertise(e.target.value)}
            />
          </label>
          <button type="button" className="lattice-btn-primary mt-4" onClick={save}>
            Save via rbacApi
          </button>
          {msg && <p className="mt-2 text-xs">{msg}</p>}
        </section>
      )}
    </SectionFrame>
  );
}
