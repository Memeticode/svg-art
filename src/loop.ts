// Animation loop with delta clamping, pause-on-hidden, and time control

export interface Loop {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  /** Seek to a specific time and render one frame (dt=0). */
  seekTo(time: number): void;
  getTime(): number;
  isPaused(): boolean;
}

export function createLoop(onFrame: (dt: number, time: number) => void): Loop {
  let rafId: number | null = null;
  let running = false;
  let paused = false;
  let lastTime = 0;
  let total = 0;

  function tick(now: number) {
    if (!running || paused) return;
    if (lastTime === 0) lastTime = now;
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.1);
    total += dt;
    onFrame(dt, total);
    rafId = requestAnimationFrame(tick);
  }

  function onVis() {
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (running && !paused) {
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      paused = false;
      lastTime = 0;
      document.addEventListener('visibilitychange', onVis);
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      paused = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      document.removeEventListener('visibilitychange', onVis);
    },
    pause() {
      if (!running || paused) return;
      paused = true;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    },
    resume() {
      if (!running || !paused) return;
      paused = false;
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
    },
    seekTo(time: number) {
      total = Math.max(0, time);
      onFrame(0, total); // render one frame at this time, no dt advance
    },
    getTime() { return total; },
    isPaused() { return paused; },
  };
}
