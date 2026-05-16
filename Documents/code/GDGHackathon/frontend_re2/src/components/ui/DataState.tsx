"use client";

export function DataState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <p className="text-sm text-lattice-deep/60">Loading from Lattice backend…</p>
    );
  }
  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Could not load data</p>
        <p className="mt-1 text-xs">{error}</p>
        {onRetry && (
          <button type="button" className="lattice-btn-ghost mt-3 text-xs" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }
  if (empty) {
    return <p className="text-sm text-lattice-deep/60">No records yet.</p>;
  }
  return null;
}
