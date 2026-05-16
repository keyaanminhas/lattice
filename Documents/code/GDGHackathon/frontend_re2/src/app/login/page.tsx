import { Suspense } from "react";
import { LatticeLogo } from "@/components/brand/LatticeLogo";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-lattice-surface lg:flex-row">
      {/* Brand panel — desktop */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-lattice-navy via-lattice-deep to-lattice-primary p-12 text-white lg:flex lg:w-[46%] xl:w-1/2">
        <LatticeLogo height={44} inverted href="/" />
        <div className="max-w-md">
          <p className="font-mono text-xs uppercase tracking-widest text-lattice-accent">
            Enterprise gateway
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight">Secure workspace access</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Firebase Auth with custom claims. Role-based routing to your tenant. Graph RAG and
            explainable matching on the live Lattice stack.
          </p>
        </div>
        <p className="text-[10px] text-white/50">lattice-2026 · rbac-new-db · asia-southeast1</p>
      </aside>

      {/* Sign-in column */}
      <main className="flex min-h-0 flex-1 flex-col bg-white">
        <header className="flex items-center justify-between border-b border-lattice-border px-6 py-4 lg:justify-end lg:px-10">
          <LatticeLogo height={32} href="/" className="lg:hidden" />
          <a
            href="/signup"
            className="text-xs font-medium text-lattice-electric hover:underline lg:text-sm"
          >
            Request access
          </a>
        </header>

        <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-8 sm:px-8 lg:items-center lg:py-12">
          <div className="w-full max-w-md">
            <Suspense
              fallback={
                <div className="lattice-panel p-8 text-center text-sm text-lattice-deep/60">
                  Loading sign-in…
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
