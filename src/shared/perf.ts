// ── Lightweight performance helpers ──

/** Throttle a callback to at most once per `ms` milliseconds */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    const now = performance.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = performance.now();
        timer = null;
        fn(...args);
      }, ms - (now - last));
    }
  }) as T;
}

/** Estimate agent count for a viewport area */
export function agentCountForViewport(
  width: number,
  height: number,
  baseCount: number,
  minCount: number,
  maxCount: number,
): number {
  // Reference area: 1920×1080
  const refArea = 1920 * 1080;
  const area = width * height;
  const scale = Math.sqrt(area / refArea);
  return Math.round(
    Math.min(maxCount, Math.max(minCount, baseCount * scale)),
  );
}
