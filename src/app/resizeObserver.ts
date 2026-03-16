// ── Resize handling with throttled recalculation ──

import type { Viewport } from '@/shared/types';
import { throttle } from '@/shared/perf';

export type ResizeCallback = (viewport: Viewport) => void;

export interface ResizeHandler {
  start(): void;
  stop(): void;
  getViewport(): Viewport;
}

export function createResizeHandler(
  container: HTMLElement,
  onResize: ResizeCallback,
): ResizeHandler {
  let viewport: Viewport = measure();

  function measure(): Viewport {
    return {
      width: container === document.body
        ? window.innerWidth
        : container.clientWidth,
      height: container === document.body
        ? window.innerHeight
        : container.clientHeight,
    };
  }

  const handleResize = throttle(() => {
    viewport = measure();
    onResize(viewport);
  }, 200);

  function start(): void {
    window.addEventListener('resize', handleResize);
    viewport = measure();
  }

  function stop(): void {
    window.removeEventListener('resize', handleResize);
  }

  function getViewport(): Viewport {
    return viewport;
  }

  return { start, stop, getViewport };
}
