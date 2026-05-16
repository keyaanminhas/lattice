import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getRbacFirestore } from "@/lib/firebase/firestore";

export type DocRow = { id: string } & Record<string, unknown>;

function mapDocs(snap: { docs: { id: string; data: () => DocumentData }[] }): DocRow[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getOrganisation(orgId: string) {
  const snap = await getDoc(doc(getRbacFirestore(), "organisations", orgId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as DocRow) : null;
}

export async function getProgramme(programmeId: string) {
  const snap = await getDoc(doc(getRbacFirestore(), "programmes", programmeId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as DocRow) : null;
}

export async function getStartup(startupId: string) {
  const snap = await getDoc(doc(getRbacFirestore(), "startups", startupId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as DocRow) : null;
}

export async function getContributor(contributorId: string) {
  const snap = await getDoc(doc(getRbacFirestore(), "contributors", contributorId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as DocRow) : null;
}

export async function listOrganisations(max = 50) {
  const snap = await getDocs(query(collection(getRbacFirestore(), "organisations"), limit(max)));
  return mapDocs(snap);
}

export async function listProgrammesByOrg(orgId: string) {
  const snap = await getDocs(
    query(collection(getRbacFirestore(), "programmes"), where("orgId", "==", orgId), limit(50)),
  );
  return mapDocs(snap);
}

export async function listContributorsByOrg(orgId: string) {
  const snap = await getDocs(
    query(collection(getRbacFirestore(), "contributors"), where("orgId", "==", orgId), limit(50)),
  );
  return mapDocs(snap);
}

export async function listApplicationsForProgramme(programmeId: string) {
  const snap = await getDocs(
    query(
      collection(getRbacFirestore(), "applications"),
      where("programmeId", "==", programmeId),
      limit(100),
    ),
  );
  return mapDocs(snap);
}

export async function listApplicationsForStartup(startupId: string) {
  const snap = await getDocs(
    query(
      collection(getRbacFirestore(), "applications"),
      where("startupId", "==", startupId),
      limit(50),
    ),
  );
  return mapDocs(snap);
}

export async function listProgrammePool(programmeId: string) {
  const snap = await getDocs(
    query(
      collection(getRbacFirestore(), "programmeContributors"),
      where("programmeId", "==", programmeId),
      limit(100),
    ),
  );
  return mapDocs(snap);
}

export async function listPendingMentorRecommendations(programmeId: string) {
  const snap = await getDocs(
    query(
      collection(getRbacFirestore(), "recommendations"),
      where("programmeId", "==", programmeId),
      where("recommendationType", "==", "Startup-to-Mentor"),
      where("status", "==", "Pending Approval"),
      limit(50),
    ),
  );
  return mapDocs(snap);
}

export async function listOrgReviewQueue(orgId: string) {
  const [appsSnap, recsSnap] = await Promise.all([
    getDocs(
      query(
        collection(getRbacFirestore(), "applications"),
        where("orgId", "==", orgId),
        limit(100),
      ),
    ),
    getDocs(
      query(
        collection(getRbacFirestore(), "recommendations"),
        where("orgId", "==", orgId),
        where("status", "==", "Pending Approval"),
        limit(50),
      ),
    ),
  ]);

  const apps = mapDocs(appsSnap).filter((a) => a.status === "Pending Admin Review");
  const recs = mapDocs(recsSnap);

  const startupIds = new Set<string>();
  const contributorIds = new Set<string>();
  const programmeIds = new Set<string>();

  for (const a of apps) {
    if (a.startupId) startupIds.add(String(a.startupId));
    if (a.programmeId) programmeIds.add(String(a.programmeId));
  }
  for (const r of recs) {
    if (r.sourceEntityId) startupIds.add(String(r.sourceEntityId));
    if (r.targetEntityId) contributorIds.add(String(r.targetEntityId));
    if (r.programmeId) programmeIds.add(String(r.programmeId));
  }

  const nameMap = new Map<string, string>();
  await Promise.all([
    ...[...startupIds].map(async (id) => {
      const s = await getStartup(id);
      if (s) nameMap.set(`startup:${id}`, String(s.name || id));
    }),
    ...[...contributorIds].map(async (id) => {
      const c = await getContributor(id);
      if (c) nameMap.set(`contributor:${id}`, String(c.name || id));
    }),
    ...[...programmeIds].map(async (id) => {
      const p = await getProgramme(id);
      if (p) nameMap.set(`programme:${id}`, String(p.name || id));
    }),
  ]);

  return { apps, recs, nameMap };
}

export async function listGraphEdgesForProgramme(programmeId: string, max = 80) {
  const snap = await getDocs(
    query(
      collection(getRbacFirestore(), "graph_edges"),
      where("programmeId", "==", programmeId),
      limit(max),
    ),
  );
  return mapDocs(snap);
}

export async function listAuditLogs(max = 25) {
  const snap = await getDocs(
    query(collection(getRbacFirestore(), "audit_logs"), limit(max)),
  );
  return mapDocs(snap).sort((a, b) => {
    const ta = String(a.createdAt ?? "");
    const tb = String(b.createdAt ?? "");
    return tb.localeCompare(ta);
  });
}

export async function listContributorPoolAssignments(contributorId: string) {
  const snap = await getDocs(
    query(
      collection(getRbacFirestore(), "programmeContributors"),
      where("contributorId", "==", contributorId),
      limit(50),
    ),
  );
  return mapDocs(snap);
}
