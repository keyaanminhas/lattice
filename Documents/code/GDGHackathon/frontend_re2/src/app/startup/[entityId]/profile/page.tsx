"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { startupNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { getStartup } from "@/lib/data/firestoreQueries";
import { updateStartupProfile } from "@/lib/api/rbac";

export default function StartupProfilePage() {
  const { entityId } = useParams<{ entityId: string }>();
  const profile = useAsync(() => getStartup(entityId), [entityId]);
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await updateStartupProfile(entityId, { problemStatement: problem });
      setMsg("Profile updated.");
      profile.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionFrame title="Startup profile" subtitle="Pitch & embeddings" nav={startupNav(entityId)}>
      <DataState loading={profile.loading} error={profile.error} onRetry={profile.reload} />
      {profile.data && (
        <section className="lattice-panel max-w-xl p-6 text-sm">
          <label className="block text-xs font-medium">
            Problem statement
            <textarea
              className="mt-1 w-full rounded border border-lattice-border p-2"
              rows={4}
              defaultValue={String(profile.data.problemStatement || "")}
              onChange={(e) => setProblem(e.target.value)}
            />
          </label>
          <button type="button" className="lattice-btn-primary mt-4" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save via rbacApi"}
          </button>
          {msg && <p className="mt-2 text-xs">{msg}</p>}
        </section>
      )}
    </SectionFrame>
  );
}
