"use client";

import * as React from "react";

type UsePollingOptions<T> = {
  enabled?: boolean;
  intervalMs?: number;
  poll: () => Promise<T>;
  onData: (data: T) => void;
  onError?: (error: unknown) => void;
};

export function usePolling<T>({
  enabled = true,
  intervalMs = 5_000,
  poll,
  onData,
  onError,
}: UsePollingOptions<T>) {
  const pollRef = React.useRef(poll);
  const onDataRef = React.useRef(onData);
  const onErrorRef = React.useRef(onError);

  React.useEffect(() => {
    pollRef.current = poll;
    onDataRef.current = onData;
    onErrorRef.current = onError;
  });

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      try {
        const data = await pollRef.current();
        if (!cancelled) onDataRef.current(data);
      } catch (error) {
        if (!cancelled) onErrorRef.current?.(error);
      }
    }

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);
}
