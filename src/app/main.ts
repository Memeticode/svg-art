// ── Living Field: application entry point ──

import { createLivingFieldApp } from './createLivingFieldApp';

// Read seed from URL params if present, otherwise use a timestamp-derived seed
const params = new URLSearchParams(window.location.search);
const seed = params.get('seed') ?? `field-${Date.now()}`;
const preset = params.get('preset') ?? 'resonant-drift';
const debugParam = params.get('debug');

const app = createLivingFieldApp({
  seed,
  preset,
  container: document.body,
  pauseWhenHidden: true,
  debugModes: debugParam ? debugParam.split(',').filter(Boolean) as import('@/render/DebugOverlays').DebugMode[] : undefined,
});

// Expose for developer console access
(window as unknown as Record<string, unknown>).__livingField = app;

// Log startup info
console.log(
  `%c✦ Living Field started %c seed="${seed}" preset="${preset}"`,
  'color: #2dd4bf; font-weight: bold',
  'color: #94a3b8',
);
