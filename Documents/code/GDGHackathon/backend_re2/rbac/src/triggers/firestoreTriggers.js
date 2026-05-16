import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  handleContributorDocumentWrite,
  handleStartupDocumentWrite,
} from "../ai/profileEngine.js";

const RBAC_DB = process.env.RBAC_FIRESTORE_DATABASE || "rbac-new-db";

export const onStartupProfileWritten = onDocumentWritten(
  {
    document: "startups/{startupId}",
    database: RBAC_DB,
    region: "asia-southeast1",
  },
  async (event) => {
    try {
      return await handleStartupDocumentWrite(event);
    } catch (err) {
      console.error("onStartupProfileWritten", err);
      return { error: err.message };
    }
  },
);

export const onContributorProfileWritten = onDocumentWritten(
  {
    document: "contributors/{contributorId}",
    database: RBAC_DB,
    region: "asia-southeast1",
  },
  async (event) => {
    try {
      return await handleContributorDocumentWrite(event);
    } catch (err) {
      console.error("onContributorProfileWritten", err);
      return { error: err.message };
    }
  },
);
