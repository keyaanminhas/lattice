"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { LatticeClaims } from "@/lib/auth/roles";
import { resolveHomePath, pathMatchesRole } from "@/lib/auth/routing";
import { syncAuthClaims } from "@/lib/api/rbac";
import { useRouter, usePathname } from "next/navigation";

interface AuthState {
  user: User | null;
  claims: LatticeClaims;
  loading: boolean;
  signIn: (email: string, password: string, nextPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<LatticeClaims>;
  homePath: string;
  postLoginNext: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

function claimsFromToken(token: Record<string, unknown>): LatticeClaims {
  return {
    role: token.role as LatticeClaims["role"],
    orgId: token.orgId as string | undefined,
    programmeId: token.programmeId as string | undefined,
    entityId: token.entityId as string | undefined,
  };
}

function setSessionCookie(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.cookie = "lattice_session=1; path=/; max-age=86400; SameSite=Lax";
  } else {
    document.cookie = "lattice_session=; path=/; max-age=0";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<LatticeClaims>({});
  const [loading, setLoading] = useState(true);
  const [postLoginNext, setPostLoginNext] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const refreshClaims = useCallback(async () => {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;
    if (!current) {
      setClaims({});
      return {};
    }
    try {
      await syncAuthClaims();
    } catch (e) {
      console.warn("syncAuthClaims:", e);
    }
    const tokenResult = await current.getIdTokenResult(true);
    const next = claimsFromToken(tokenResult.claims as Record<string, unknown>);
    setClaims(next);
    return next;
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setSessionCookie(true);
        const tokenResult = await u.getIdTokenResult();
        setClaims(claimsFromToken(tokenResult.claims as Record<string, unknown>));
      } else {
        setSessionCookie(false);
        setClaims({});
      }
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, nextPath?: string) => {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      await refreshClaims();
      setPostLoginNext(nextPath || null);
      router.replace("/auth/resolve");
    },
    [refreshClaims, router],
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
    setSessionCookie(false);
    setPostLoginNext(null);
    router.replace("/login");
  }, [router]);

  const homePath = useMemo(() => resolveHomePath(claims), [claims]);

  const value = useMemo(
    () => ({
      user,
      claims,
      loading,
      signIn,
      signOut,
      refreshClaims,
      homePath,
      postLoginNext,
    }),
    [user, claims, loading, signIn, signOut, refreshClaims, homePath, postLoginNext],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!auth || auth.loading) return;
    if (!auth.user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!auth.claims.role) {
      router.replace("/auth/pending");
      return;
    }
    if (!pathMatchesRole(pathname, auth.claims)) {
      router.replace(auth.homePath);
    }
  }, [auth, pathname, router]);

  if (!auth || auth.loading || !auth.user || !auth.claims.role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lattice-surface text-sm text-lattice-deep">
        Resolving secure workspace…
      </div>
    );
  }

  return <>{children}</>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
