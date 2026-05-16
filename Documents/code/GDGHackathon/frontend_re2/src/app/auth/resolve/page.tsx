"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { resolveHomePath } from "@/lib/auth/routing";
import { pathMatchesRole } from "@/lib/auth/routing";

/** Interstitial: resolve role → tenant home (post-login traffic controller). */
export default function AuthResolvePage() {
  const { user, loading, refreshClaims, postLoginNext } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    refreshClaims().then((claims) => {
      if (!claims.role) {
        router.replace("/auth/pending");
        return;
      }
      const home = resolveHomePath(claims);
      if (postLoginNext && pathMatchesRole(postLoginNext, claims)) {
        router.replace(postLoginNext);
      } else {
        router.replace(home);
      }
    });
  }, [user, loading, router, refreshClaims, postLoginNext]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-lattice-surface text-sm text-lattice-deep">
      Resolving role and tenant scope…
    </div>
  );
}
