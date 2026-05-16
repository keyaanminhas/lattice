import { Suspense } from "react";
import { MatchesClient } from "./MatchesClient";

export default async function ProgrammeMatchesPage({
  params,
}: {
  params: Promise<{ programmeId: string }>;
}) {
  const { programmeId } = await params;
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading matches…</p>}>
      <MatchesClient programmeId={programmeId} />
    </Suspense>
  );
}
