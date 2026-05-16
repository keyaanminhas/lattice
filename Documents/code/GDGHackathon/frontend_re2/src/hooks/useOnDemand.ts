"use client";

import { useCallback, useState } from "react";

/** Run an async fetch only when invoked — avoids auto Gemini / API calls on mount. */
export function useOnDemand<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed";
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [fn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, run, reset };
}
