#!/usr/bin/env node
/** Sync rbac/ -> rbac-functions/ (isolated deploy clone; never touches Python functions/). */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = path.join(root, "rbac");
const dst = path.join(root, "rbac-functions");

mkdirSync(dst, { recursive: true });
cpSync(path.join(src, "src"), path.join(dst, "src"), { recursive: true });
cpSync(path.join(src, "index.js"), path.join(dst, "index.js"));
cpSync(path.join(src, "package.json"), path.join(dst, "package.json"));

console.log("[syncFunctionsClone] Updated rbac-functions from rbac/");
console.log("  Live Python: functions/ (codebase: default) — unchanged");
console.log("  RBAC Node:   rbac-functions/ (codebase: rbac-isolated) — deploy this only");
