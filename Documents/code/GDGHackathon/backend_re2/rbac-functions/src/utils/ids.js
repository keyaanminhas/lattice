import { randomBytes } from "node:crypto";

export function newId(prefix) {
  const suffix = randomBytes(4).toString("hex");
  return `${prefix}-${Date.now().toString(36)}-${suffix}`;
}
