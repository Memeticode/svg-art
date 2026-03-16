// ── Runtime configuration types ──

export interface CreateLivingFieldOptions {
  seed?: string | number;
  preset?: string;
  container?: HTMLElement;
  pauseWhenHidden?: boolean;
}

export interface LivingFieldAppHandle {
  start(): void;
  stop(): void;
  destroy(): void;
  resize(): void;
  setPreset(name: string): void;
}
