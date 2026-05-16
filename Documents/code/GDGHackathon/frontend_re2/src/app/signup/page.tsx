"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { classifySignupBio } from "@/lib/signup/classifyProfile";
import { ROLES, type LatticeRole, isContributorRole } from "@/lib/auth/roles";
import { LatticeLogo } from "@/components/brand/LatticeLogo";
import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  registerContributorProfile,
  registerStartupProfile,
} from "@/lib/api/rbac";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABELS: Record<LatticeRole, string> = {
  [ROLES.PLATFORM_ADMIN]: "Platform Admin",
  [ROLES.ORG_ADMIN]: "Organisation Admin",
  [ROLES.PROGRAMME_ADMIN]: "Programme Admin",
  [ROLES.STARTUP]: "Startup",
  [ROLES.MENTOR]: "Mentor",
  [ROLES.PARTNER]: "Partner",
  [ROLES.INVESTOR]: "Investor",
  [ROLES.SERVICE_PROVIDER]: "Service Provider",
};

const SELF_SERVE_ROLES: LatticeRole[] = [
  ROLES.STARTUP,
  ROLES.MENTOR,
  ROLES.PARTNER,
  ROLES.INVESTOR,
  ROLES.SERVICE_PROVIDER,
];

export default function SignupPage() {
  const router = useRouter();
  const { refreshClaims } = useAuth();
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [overrideRole, setOverrideRole] = useState<LatticeRole | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const classification = useMemo(() => classifySignupBio(bio), [bio]);
  const role = overrideRole || classification.suggestedRole;

  async function completeSignup() {
    if (!SELF_SERVE_ROLES.includes(role)) {
      setError("Org and platform admins are provisioned by an existing administrator.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      await createUserWithEmailAndPassword(auth, email, password);

      if (role === ROLES.STARTUP) {
        await registerStartupProfile({
          name,
          email,
          sector: "HealthTech",
          country: "SG",
          problemStatement: bio,
          productDescription: bio,
        });
      } else if (isContributorRole(role)) {
        await registerContributorProfile({
          name,
          email,
          role,
          expertise: classification.signals.map((s) => s.label).slice(0, 5),
        });
      }

      await refreshClaims();
      router.replace("/auth/resolve");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-lattice-surface">
      <header className="border-b border-lattice-border bg-white px-8 py-4">
        <LatticeLogo />
      </header>
      <main className="mx-auto max-w-xl px-8 py-12">
        <p className="font-mono text-xs text-lattice-electric">Step {step} of 3 · Progressive profiling</p>
        <h1 className="mt-2 text-2xl font-semibold text-lattice-navy">Join the Lattice ecosystem</h1>

        {step === 1 && (
          <div className="mt-8 lattice-panel p-6">
            <label className="block text-xs font-medium">
              Describe your organisation or goals
              <textarea
                className="mt-2 w-full rounded border border-lattice-border p-3 text-sm"
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Seed-stage HealthTech founder seeking mentorship…"
              />
            </label>
            {bio.length > 20 && (
              <div className="mt-4 rounded border border-lattice-electric/30 bg-lattice-electric/5 p-3 text-xs">
                <p className="font-semibold text-lattice-electric">AI routing suggestion</p>
                <p className="mt-1">
                  {ROLE_LABELS[classification.suggestedRole]} ·{" "}
                  {Math.round(classification.confidence * 100)}% confidence
                </p>
              </div>
            )}
            <button type="button" className="lattice-btn-primary mt-6" onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 lattice-panel p-6">
            <label className="block text-xs font-medium">
              Confirm role track
              <select
                className="mt-2 w-full rounded border border-lattice-border px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setOverrideRole(e.target.value as LatticeRole)}
              >
                {SELF_SERVE_ROLES.map((k) => (
                  <option key={k} value={k}>
                    {ROLE_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-xs font-medium">
              Full name
              <input
                className="mt-1 w-full rounded border border-lattice-border px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="mt-4 block text-xs font-medium">
              Work email
              <input
                type="email"
                className="mt-1 w-full rounded border border-lattice-border px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="mt-4 block text-xs font-medium">
              Password (min 8 characters)
              <input
                type="password"
                className="mt-1 w-full rounded border border-lattice-border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <div className="mt-6 flex gap-2">
              <button type="button" className="lattice-btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="lattice-btn-primary"
                onClick={() => setStep(3)}
                disabled={!name || !email || password.length < 8}
              >
                Review
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 lattice-panel p-6 text-sm">
            <p>
              Create account as <strong>{ROLE_LABELS[role]}</strong> and provision profile via{" "}
              <code className="font-mono text-xs">rbacApi</code>.
            </p>
            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
            <div className="mt-6 flex gap-2">
              <button type="button" className="lattice-btn-ghost" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                type="button"
                className="lattice-btn-primary"
                disabled={loading}
                onClick={completeSignup}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </div>
            <p className="mt-4 text-xs text-lattice-deep/60">
              Already registered? <Link href="/login" className="text-lattice-electric">Sign in</Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
