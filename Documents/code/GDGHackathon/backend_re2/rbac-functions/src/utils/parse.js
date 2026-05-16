import { HttpsError } from "firebase-functions/v2/https";

export function cleanString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim() || fallback;
}

export function cleanStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

export function parseData(request) {
  if (!request.data || typeof request.data !== "object" || Array.isArray(request.data)) {
    throw new HttpsError("invalid-argument", "Request body must be an object.");
  }
  return request.data;
}

export function requireField(data, key) {
  const value = cleanString(data[key]);
  if (!value) {
    throw new HttpsError("invalid-argument", `${key} is required.`);
  }
  return value;
}
