const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export function assertFirebaseEnv() {
  if (typeof window === "undefined") return;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("Missing Firebase env:", missing.join(", "));
  }
}

export function isFirebaseConfigured() {
  return required.every((k) => Boolean(process.env[k]));
}
