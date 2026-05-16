import Link from "next/link";
import { LatticeGraphHero } from "@/components/graph/LatticeGraphHero";
import { LatticeLogo } from "@/components/brand/LatticeLogo";

const CAPABILITY_CARDS = [
  {
    title: "Graph-backed approvals",
    body: "Every recommendation can be traced back to applications, contributor pool membership, and graph evidence instead of opaque scoring alone.",
  },
  {
    title: "Role-scoped workspaces",
    body: "Platform, organisation, programme, startup, and contributor views stay separate so each operator sees the right control surface instead of a generic dashboard.",
  },
  {
    title: "AI with operational context",
    body: "Summaries, fit scores, and review queues are surfaced where decisions happen, not hidden behind a demo-only prompt box.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <header className="sticky top-0 z-10 border-b border-lattice-border/70 bg-white/78 px-8 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <LatticeLogo />
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-lattice-deep hover:text-lattice-electric">
              Sign in
            </Link>
            <Link href="/signup" className="lattice-btn-primary">
              Request access
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-8 py-12">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-lattice-electric">
              Enterprise programme intelligence
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-lattice-navy">
              Govern startup ecosystems with Graph RAG that can survive audit.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-lattice-deep/78">
              Lattice maps startups, programmes, contributors, and outcomes as an operational graph.
              Matching is explainable, review queues are visible, and role-scoped workspaces turn
              recommendation logic into something programme teams can actually run.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="lattice-btn-primary">
                Start onboarding
              </Link>
              <Link href="/login" className="lattice-btn-ghost">
                Admin gateway
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="lattice-kpi-card">
                <p className="text-[11px] uppercase tracking-[0.16em] text-lattice-deep/50">
                  Roles
                </p>
                <p className="mt-2 text-3xl font-semibold text-lattice-navy">9</p>
                <p className="mt-1 text-xs text-lattice-deep/65">
                  Distinct entity roles across platform, programmes, startups, and contributors.
                </p>
              </div>
              <div className="lattice-kpi-card">
                <p className="text-[11px] uppercase tracking-[0.16em] text-lattice-deep/50">
                  Explainability
                </p>
                <p className="mt-2 text-3xl font-semibold text-lattice-navy">RAG</p>
                <p className="mt-1 text-xs text-lattice-deep/65">
                  Graph evidence is surfaced next to scores and decisions.
                </p>
              </div>
              <div className="lattice-kpi-card">
                <p className="text-[11px] uppercase tracking-[0.16em] text-lattice-deep/50">
                  Review mode
                </p>
                <p className="mt-2 text-3xl font-semibold text-lattice-navy">XAI</p>
                <p className="mt-1 text-xs text-lattice-deep/65">
                  Admins can inspect decomposition, risks, and graph links before approval.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <LatticeGraphHero />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-lattice-border/80 bg-white/82 px-4 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/48">
                  Intake
                </p>
                <p className="mt-2 text-sm font-semibold text-lattice-navy">Profile to programme fit</p>
              </div>
              <div className="rounded-2xl border border-lattice-border/80 bg-white/82 px-4 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/48">
                  Matching
                </p>
                <p className="mt-2 text-sm font-semibold text-lattice-navy">Startup to mentor review</p>
              </div>
              <div className="rounded-2xl border border-lattice-border/80 bg-white/82 px-4 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/48">
                  Outcomes
                </p>
                <p className="mt-2 text-sm font-semibold text-lattice-navy">Learning loop for future approvals</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {CAPABILITY_CARDS.map((card) => (
            <article key={card.title} className="lattice-panel p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/45">
                Capability
              </p>
              <h2 className="mt-2 text-lg font-semibold text-lattice-navy">{card.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-lattice-deep/76">{card.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 rounded-[28px] border border-white/80 bg-white/76 p-6 shadow-panel backdrop-blur-sm lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lattice-deep/45">
              Why this feels different
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-lattice-navy">
              Less demo theatre, more operating system for programme teams.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-lattice-deep/76">
              Most matching products stop at a score and a thin list view. Lattice is built around
              the full operating loop: profile intake, recommendation generation, approval, graph
              evidence, and outcome tracking. That lets teams move faster without pretending the AI
              is infallible.
            </p>
          </div>
          <div className="lattice-subtle-grid rounded-[24px] border border-lattice-border/80 bg-lattice-surface/62 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-lattice-deep/48">
                  Surface area
                </p>
                <p className="mt-2 text-3xl font-semibold text-lattice-navy">Single callable API</p>
                <p className="mt-2 text-xs leading-relaxed text-lattice-deep/68">
                  One RBAC entrypoint for scoped actions keeps the backend operationally compact.
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-lattice-deep/48">
                  Auditability
                </p>
                <p className="mt-2 text-3xl font-semibold text-lattice-navy">Live graph evidence</p>
                <p className="mt-2 text-xs leading-relaxed text-lattice-deep/68">
                  Scores are paired with graph edges, risk flags, and review workflows.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
