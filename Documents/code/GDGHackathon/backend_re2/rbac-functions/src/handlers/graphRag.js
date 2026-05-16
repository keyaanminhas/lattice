import { HttpsError } from "firebase-functions/v2/https";
import { requireRole } from "../auth/middleware.js";
import { ROLES } from "../auth/roles.js";
import { rebuildGraphRag } from "../ai/rebuildGraph.js";
import { getStartupProgrammeGraphContext } from "../ai/graphService.js";
import { scoreStartupProgrammeFit, loadPlatformConfig } from "../ai/latticeGraph.js";
import { getRbacDb } from "../db.js";
import { parseData, requireField } from "../utils/parse.js";

export async function rebuildGraphRagHandler(request) {
  requireRole(request, [ROLES.PLATFORM_ADMIN, ROLES.ORG_ADMIN, ROLES.PROGRAMME_ADMIN]);
  const data = parseData(request);
  const programmeId = data.programmeId ? String(data.programmeId).trim() : null;
  const clearFirst = Boolean(data.clearFirst);

  const stats = await rebuildGraphRag({ programmeId, clearFirst });
  return { ok: true, stats, graphRagEnabled: true };
}

export async function getGraphRagContextHandler(request) {
  const data = parseData(request);
  const startupId = requireField(data, "startupId");
  const programmeId = requireField(data, "programmeId");

  const db = getRbacDb();
  const context = await getStartupProgrammeGraphContext(db, startupId, programmeId);
  const platformConfig = await loadPlatformConfig(db);
  const startupSnap = await db.collection("startups").doc(startupId).get();
  const programmeSnap = await db.collection("programmes").doc(programmeId).get();

  let fit = null;
  if (startupSnap.exists && programmeSnap.exists) {
    fit = await scoreStartupProgrammeFit(
      db,
      { id: startupSnap.id, ...startupSnap.data() },
      { id: programmeSnap.id, ...programmeSnap.data() },
      platformConfig,
    );
  }

  return { context, fit, graphRagEnabled: true };
}
