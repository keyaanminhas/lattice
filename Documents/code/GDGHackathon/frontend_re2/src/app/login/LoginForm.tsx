"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DemoLoginPanel } from "@/components/auth/DemoLoginPanel";
import { useAuth } from "@/context/AuthContext";

export function LoginForm() {
  const { signIn } = useAuth();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(email, password, nextPath || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="lattice-panel w-full p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-lattice-navy">Sign in</h2>
      <p className="mt-1 text-sm text-lattice-deep/60">Email and password</p>
      {nextPath && (
        <p className="mt-3 rounded border border-lattice-electric/20 bg-lattice-electric/5 px-3 py-2 text-xs text-lattice-deep">
          You will return to <span className="font-mono text-lattice-electric">{nextPath}</span>{" "}
          after authentication.
        </p>
      )}

      <label className="mt-6 block text-xs font-medium text-lattice-deep">
        Email
        <input
          type="email"
          autoComplete="email"
          className="mt-1.5 w-full rounded border border-lattice-border bg-white px-3 py-2.5 text-sm outline-none ring-lattice-electric/30 focus:border-lattice-electric focus:ring-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className="mt-4 block text-xs font-medium text-lattice-deep">
        Password
        <input
          type="password"
          autoComplete="current-password"
          className="mt-1.5 w-full rounded border border-lattice-border bg-white px-3 py-2.5 text-sm outline-none ring-lattice-electric/30 focus:border-lattice-electric focus:ring-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <button type="submit" className="lattice-btn-primary mt-6 w-full py-2.5" disabled={loading}>
        {loading ? "Authenticating…" : "Enter workspace"}
      </button>

      <DemoLoginPanel
        onPick={(e, p) => {
          setEmail(e);
          setPassword(p);
        }}
      />

      <p className="mt-6 text-center text-xs text-lattice-deep/60">
        New to Lattice?{" "}
        <Link href="/signup" className="font-medium text-lattice-electric hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
