"use client";

import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { contributorNav } from "@/lib/nav/menus";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getContributor, listContributorPoolAssignments } from "@/lib/data/firestoreQueries";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { NarrativePanel } from "@/components/ui/NarrativePanel";
import { PageIntro } from "@/components/ui/PageIntro";
import { SignalBars } from "@/components/ui/SignalBars";

export default function ContributorHubPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const { claims } = useAuth();
  const profile = useAsync(() => getContributor(entityId), [entityId]);
  const assignments = useAsync(() => listContributorPoolAssignments(entityId), [entityId]);

  const approvedAssignments =
    assignments.data?.filter((item) => item.status === "Approved").length ?? 0;
  const pendingAssignments =
    assignments.data?.filter((item) => item.status === "Pending").length ?? 0;
  const expertise =
    Array.isArray(profile.data?.expertise) ? (profile.data?.expertise as string[]).map(String) : [];
  const capacity =
    profile.data && typeof profile.data.capacity === "object" && profile.data.capacity
      ? (profile.data.capacity as Record<string, unknown>)
      : {};
  const programmeCap = Number(capacity.globalMaxProgrammes ?? 0);
  const startupCap = Number(capacity.globalMaxStartupAssignments ?? 0);

  return (
    <SectionFrame
      title="Contributor hub"
      subtitle={`${claims.role?.replace("_", " ")} | ${profile.data ? String(profile.data.name) : entityId}`}
      nav={contributorNav(entityId)}
    >
      <PageIntro>
        Contributor workspaces should make availability, expertise, and programme demand obvious.
        This view now surfaces assignment load and capacity context instead of leaving the page as a
        bare profile readout.
      </PageIntro>

      <DataState loading={profile.loading} error={profile.error} onRetry={profile.reload} />

      {profile.data && (
        <>
          <MetricStrip
            items={[
              {
                label: "Approved assignments",
                value: approvedAssignments,
                detail: "Programmes where this contributor is currently approved.",
                tone: approvedAssignments > 0 ? "accent" : "default",
              },
              {
                label: "Pending invites",
                value: pendingAssignments,
                detail: "Programme assignments waiting for contributor action.",
                tone: pendingAssignments > 0 ? "warning" : "default",
              },
              {
                label: "Expertise tags",
                value: expertise.length,
                detail: "Signals used when matching contributors to startups and programmes.",
              },
              {
                label: "Availability",
                value: String(profile.data.availability || "-"),
                detail: "Current declared working state for programme matching.",
              },
            ]}
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="lattice-panel p-6 text-sm">
              <h2 className="text-sm font-semibold text-lattice-navy">Contributor profile</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-lattice-deep/60">Role</p>
                  <p className="mt-0.5 text-lattice-navy">{String(profile.data.role || claims.role || "-")}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-lattice-deep/60">Status</p>
                  <p className="mt-0.5 text-lattice-navy">
                    {String(profile.data.status || profile.data.verificationStatus || "-")}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-lattice-deep/60">Expertise</p>
                  <p className="mt-1 leading-relaxed text-lattice-deep/80">
                    {expertise.length > 0 ? expertise.join(", ") : "-"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-lattice-deep/60">Supported stages</p>
                  <p className="mt-1 leading-relaxed text-lattice-deep/80">
                    {Array.isArray(profile.data.supportedStages)
                      ? (profile.data.supportedStages as string[]).join(", ")
                      : "-"}
                  </p>
                </div>
              </div>
            </section>

            <div className="space-y-6">
              <SignalBars
                title="Capacity profile"
                subtitle="Declared capacity versus current approved programme load."
                items={[
                  {
                    label: "Programme slots used",
                    value: approvedAssignments,
                    max: Math.max(1, programmeCap || approvedAssignments || 1),
                    note: "Approved assignments relative to programme capacity.",
                    tone: approvedAssignments >= programmeCap && programmeCap > 0 ? "warning" : "accent",
                  },
                  {
                    label: "Startup assignment budget",
                    value: approvedAssignments,
                    max: Math.max(1, startupCap || approvedAssignments || 1),
                    note: "Quick proxy using active programme approvals.",
                    tone: "success",
                  },
                  {
                    label: "Availability state",
                    value: profile.data.availability === "Unavailable" ? 0 : 1,
                    max: 1,
                    note: "Unavailable contributors are deprioritised in matching.",
                    tone: profile.data.availability === "Unavailable" ? "warning" : "success",
                  },
                ]}
              />

              <NarrativePanel title="Operating guidance" eyebrow="Contributor ops">
                <p>
                  The strongest contributor profiles are specific, current, and capacity-aware. A
                  long expertise list is less useful than a narrower signal that clearly maps to
                  startup needs and supported stages.
                </p>
                <p className="mt-3">
                  Keep availability honest. The matching engine can work around limited capacity,
                  but stale availability creates false supply and degrades recommendation quality
                  for programme admins.
                </p>
              </NarrativePanel>
            </div>
          </div>
        </>
      )}
    </SectionFrame>
  );
}
