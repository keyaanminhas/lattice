import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto shrink-0 border-t border-lattice-border/70 bg-white/72 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 text-[11px] text-lattice-deep/56">
        <div>
          <p className="font-medium text-lattice-deep/70">Lattice programme intelligence</p>
          <p className="mt-0.5">Copyright {year} | Graph-backed workspace for startup ecosystems</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/login" className="hover:text-lattice-electric">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-lattice-electric">
            Request access
          </Link>
        </nav>
      </div>
    </footer>
  );
}
