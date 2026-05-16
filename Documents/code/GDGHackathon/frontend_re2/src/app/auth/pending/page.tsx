import Link from "next/link";

export default function AuthPendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-lattice-surface px-8 text-center">
      <h1 className="text-lg font-semibold text-lattice-navy">Account pending provisioning</h1>
      <p className="mt-2 max-w-md text-sm text-lattice-deep/70">
        Your identity is verified, but no role assignment was found in custom claims. An
        administrator must assign your workspace via rbacApi.
      </p>
      <Link href="/login" className="lattice-btn-primary mt-6">
        Return to gateway
      </Link>
    </div>
  );
}

