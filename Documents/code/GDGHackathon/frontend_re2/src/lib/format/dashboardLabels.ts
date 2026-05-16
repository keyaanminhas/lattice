const STAT_LABELS: Record<string, string> = {
  totalOrganisations: "Organisations",
  openProgrammes: "Open programmes",
  totalStartups: "Startups in network",
  verifiedStartups: "Verified startups",
  totalContributors: "Contributors",
  programmePoolAssignments: "Pool assignments",
  pendingApplications: "Applications awaiting review",
  acceptedApplications: "Accepted applications",
  pendingRecommendations: "Matches pending approval",
  activeRelationships: "Active relationships",
  graphEdges: "Graph edges",
  totalOutcomes: "Recorded outcomes",
  successfulOutcomes: "Successful outcomes",
  successRate: "Outcome success rate",
};

export function labelStatKey(key: string): string {
  return STAT_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

export function formatStatValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (key === "successRate" && typeof value === "number") return `${value}%`;
  return String(value);
}

const GRAPH_COUNT_LABELS: Record<string, string> = {
  graphEdges: "Relationship edges",
  attachedContributors: "Contributors in pool",
  acceptedStartups: "Startups in cohort",
  pendingApplications: "Applications in review",
  pools: "Pool records",
  recommendations: "Recommendations",
};

export function labelGraphCountKey(key: string): string {
  return GRAPH_COUNT_LABELS[key] ?? labelStatKey(key);
}
