// ── Runtime configuration types ──

import type { DebugMode } from '@/render/DebugOverlays';

export interface CreateLivingFieldOptions {
  seed?: string | number;
  preset?: string;
  container?: HTMLElement;
  pauseWhenHidden?: boolean;
  debugModes?: DebugMode[];
}

export interface LivingFieldAppHandle {
  start(): void;
  stop(): void;
  destroy(): void;
  resize(): void;
  setPreset(name: string): void;
}
