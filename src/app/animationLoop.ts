// ── Animation loop with delta clamping and pause support ──

export interface AnimationLoop {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export type FrameCallback = (dt: number, timeSec: number) => void;

export function createAnimationLoop(
  onFrame: FrameCallback,
  pauseWhenHidden: boolean,
): AnimationLoop {
  let rafId: number | null = null;
  let running = false;
  let lastTime = 0;
  let totalTimeSec = 0;

  function tick(now: number): void {
    if (!running) return;

    if (lastTime === 0) lastTime = now;
    let dt = (now - lastTime) / 1000;
    lastTime = now;

    // Clamp delta to avoid giant jumps (e.g. tab restore)
    dt = Math.min(dt, 0.1);

    totalTimeSec += dt;
    onFrame(dt, totalTimeSec);

    rafId = requestAnimationFrame(tick);
  }

  function onVisibilityChange(): void {
    if (!pauseWhenHidden) return;
    if (document.hidden) {
      // Pause: cancel rAF but keep running flag
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else {
      // Resume: reset lastTime to avoid giant delta
      if (running) {
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    lastTime = 0;
    document.addEventListener('visibilitychange', onVisibilityChange);
    rafId = requestAnimationFrame(tick);
  }

  function stop(): void {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  function isRunning(): boolean {
    return running;
  }

  return { start, stop, isRunning };
}
