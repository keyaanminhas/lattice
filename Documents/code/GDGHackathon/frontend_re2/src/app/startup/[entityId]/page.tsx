"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { SectionFrame } from "@/components/layout/SectionFrame";
import { DataState } from "@/components/ui/DataState";
import { PageIntro } from "@/components/ui/PageIntro";
import { startupNav } from "@/lib/nav/menus";
import { useAsync } from "@/hooks/useAsync";
import { getStartup } from "@/lib/data/firestoreQueries";
import { AiButton } from "@/components/ui/AiButton";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { NarrativePanel } from "@/components/ui/NarrativePanel";
import { SignalBars } from "@/components/ui/SignalBars";
import { summariseStartupProfile } from "@/lib/api/rbac";

type SummaryPayload = {
  summary?: string;
  riskFlags?: string[];
  suggestedProgrammeTypes?: string[];
};

export default function StartupHubPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const profile = useAsync(() => getStartup(entityId), [entityId]);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  async function runSummary() {
    setSummarising(true);
    setSummaryError(null);
    try {
      const res = await summariseStartupProfile(entityId);
      const p = res.profile;
      if (p && typeof p === "object" && "summary" in p) {
        setSummary({
          summary: String(p.summary ?? ""),
          riskFlags: Array.isArray(p.riskFlags) ? p.riskFlags.map(String) : [],
          suggestedProgrammeTypes: Array.isArray(p.suggestedProgrammeTypes)
            ? p.suggestedProgrammeTypes.map(String)
            : [],
        });
      } else if (typeof p === "string") {
        setSummary({ summary: p });
      } else {
        setSummaryError("No summary returned. Check Gemini configuration on rbacApi.");
      }
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setSummarising(false);
    }
  }

  const d = profile.data;
  const profileCompleteness = d
    ? [d.problemStatement, d.productDescription, d.supportNeeds, d.sector, d.stage].filter(Boolean).length
    : 0;
  const supportNeeds = Array.isArray(d?.supportNeeds) ? d.supportNeeds.map(String) : [];

  return (
    <SectionFrame title="Startup workspace" subtitle={d ? String(d.name) : entityId} nav={startupNav(entityId)}>
      <DataState loading={profile.loading} error={profile.error} onRetry={profile.reload} />
      {d && (
        <>
          <PageIntro>
            {String(d.name)} is a {String(d.stage)} {String(d.sector)} company based in{" "}
            {String(d.country)}. This workspace now gives more context around profile quality,
            support readiness, and next actions so founders are not dropped into a thin dashboard
            with just a few links.
          </PageIntro>

          <MetricStrip
            items={[
              {
                label: "Team size",
                value: String(d.teamSize ?? "-"),
                detail: "Current declared team capacity.",
              },
              {
                label: "Verification",
                value: String(d.verificationStatus ?? "Pending"),
                detail: "Trust signal used by programmes during intake.",
                tone: d.verificationStatus === "Verified" ? "accent" : "warning",
              },
              {
                label: "Support needs",
                value: supportNeeds.length,
                detail: "Captured asks that can improve match quality.",
              },
              {
                label: "Profile completeness",
                value: `${Math.round((profileCompleteness / 5) * 100)}%`,
                detail: "Simple local check across the main profile fields.",
              },
            ]}
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
            <section className="lattice-panel p-6">
              <h2 className="text-sm font-semibold text-lattice-navy">Company profile</h2>
              <p className="mt-1 text-xs text-lattice-deep/60">
                Richer context gives programme teams better evidence when reviewing or matching the
                startup.
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-lattice-deep/60">Sector</dt>
                  <dd className="mt-0.5 text-lattice-navy">{String(d.sector)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-lattice-deep/60">Stage</dt>
                  <dd className="mt-0.5 text-lattice-navy">{String(d.stage)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-lattice-deep/60">Country</dt>
                  <dd className="mt-0.5 text-lattice-navy">{String(d.country)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-lattice-deep/60">Verification</dt>
                  <dd className="mt-0.5 text-lattice-navy">{String(d.verificationStatus)}</dd>
                </div>
                {d.problemStatement != null && String(d.problemStatement).length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-lattice-deep/60">Problem</dt>
                    <dd className="mt-0.5 leading-relaxed text-lattice-deep/82">
                      {String(d.problemStatement)}
                    </dd>
                  </div>
                )}
                {d.productDescription != null && String(d.productDescription).length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-lattice-deep/60">Product</dt>
                    <dd className="mt-0.5 leading-relaxed text-lattice-deep/82">
                      {String(d.productDescription)}
                    </dd>
                  </div>
                )}
              </dl>

              <AiButton variant="primary" className="mt-5" disabled={summarising} onClick={runSummary}>
                {summarising ? "Summarising..." : "AI summarise profile"}
              </AiButton>

              {summaryError && <p className="mt-3 text-xs text-red-700">{summaryError}</p>}

              {summary?.summary && (
                <div className="mt-4 rounded-2xl border border-lattice-electric/20 bg-lattice-electric/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-lattice-electric">
                    AI narrative
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-lattice-deep/85">{summary.summary}</p>
                  {summary.riskFlags && summary.riskFlags.length > 0 && (
                    <p className="mt-3 text-xs text-amber-800">
                      <span className="font-medium">Risks:</span> {summary.riskFlags.join(" | ")}
                    </p>
                  )}
                  {summary.suggestedProgrammeTypes && summary.suggestedProgrammeTypes.length > 0 && (
                    <p className="mt-2 text-xs text-lattice-deep/70">
                      <span className="font-medium">Suggested programmes:</span>{" "}
                      {summary.suggestedProgrammeTypes.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </section>

            <div className="space-y-6">
              <SignalBars
                title="Readiness snapshot"
                subtitle="Lightweight checks to show whether the profile is ready for discovery and intake."
                items={[
                  {
                    label: "Profile coverage",
                    value: profileCompleteness,
                    max: 5,
                    note: "Problem, product, support needs, sector, and stage present.",
                    tone: "accent",
                  },
                  {
                    label: "Support signal density",
                    value: supportNeeds.length,
                    max: 5,
                    note: "More specific support needs usually improve recommendation quality.",
                    tone: "success",
                  },
                  {
                    label: "Verification readiness",
                    value: d.verificationStatus === "Verified" ? 1 : 0,
                    max: 1,
                    note: "Verified profiles clear more trust friction during review.",
                    tone: d.verificationStatus === "Verified" ? "success" : "warning",
                  },
                ]}
              />

              <NarrativePanel title="Founder guidance" eyebrow="Next moves">
                <p>
                  The goal of this workspace is to make the profile feel decision-ready. Strong
                  applications come from startups that clearly state their problem, product, stage,
                  and support asks before they start spraying applications across programmes.
                </p>
                <p className="mt-3">
                  Use AI summarisation when you need a sharper narrative for reviewers, but treat it
                  as a formatting aid. The underlying profile fields still determine most of the
                  downstream fit signal.
                </p>
              </NarrativePanel>

              <section className="lattice-panel p-6">
                <h2 className="text-sm font-semibold text-lattice-navy">Next steps</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  <li>
                    <Link
                      href={`/startup/${entityId}/programmes`}
                      className="font-medium text-lattice-electric hover:underline"
                    >
                      Discover programmes
                    </Link>
                    <p className="mt-0.5 text-xs text-lattice-deep/60">
                      Browse open accelerators and run AI fit matching on demand.
                    </p>
                  </li>
                  <li>
                    <Link
                      href={`/startup/${entityId}/applications`}
                      className="font-medium text-lattice-electric hover:underline"
                    >
                      My applications
                    </Link>
                    <p className="mt-0.5 text-xs text-lattice-deep/60">
                      Track status, scores, and reviewer decisions in one place.
                    </p>
                  </li>
                  <li>
                    <Link
                      href={`/startup/${entityId}/profile`}
                      className="font-medium text-lattice-electric hover:underline"
                    >
                      Edit profile
                    </Link>
                    <p className="mt-0.5 text-xs text-lattice-deep/60">
                      Update sector, stage, and support needs to improve discovery quality.
                    </p>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </SectionFrame>
  );
}
