// ── Residue system: fading traces after motif reorganization ──
// Residue is evidence, not decoration. Subtle, rare, temporary.
// Triggered on family-changing reseeds and rare dramatic intra-family events.

const SVG_NS = 'http://www.w3.org/2000/svg';

const MAX_ENTRIES = 60;
const PATHS_PER_ENTRY = 6; // simplified: only render first 6 active paths

export interface ResidueEntry {
  active: boolean;
  paths: { d: string; strokeWidth: number }[];
  xPx: number;
  yPx: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
  initialOpacity: number;
  maxLifeSec: number;
  ageSec: number;
  stroke: string;
}

export interface ResidueSystem {
  /** Emit a new residue trace from a reorganizing agent */
  emit(entry: Omit<ResidueEntry, 'active' | 'ageSec' | 'initialOpacity'>): void;
  /** Advance all entries, decay opacity, recycle dead entries */
  update(dt: number): void;
  /** Render active entries into the residue layer */
  render(): void;
  /** Current active count */
  activeCount(): number;
  destroy(): void;
}

export function createResidueSystem(residueLayer: SVGGElement): ResidueSystem {
  const entries: ResidueEntry[] = [];
  const domGroups: SVGGElement[] = [];

  // Pre-allocate DOM groups
  for (let i = 0; i < MAX_ENTRIES; i++) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('display', 'none');
    g.style.willChange = 'opacity';

    for (let j = 0; j < PATHS_PER_ENTRY; j++) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke-linecap', 'round');
      g.appendChild(p);
    }

    residueLayer.appendChild(g);
    domGroups.push(g);

    entries.push({
      active: false,
      paths: [],
      xPx: 0, yPx: 0,
      scale: 1, rotationDeg: 0,
      opacity: 0, initialOpacity: 0,
      maxLifeSec: 10,
      ageSec: 0,
      stroke: '#ffffff',
    });
  }

  function emit(input: Omit<ResidueEntry, 'active' | 'ageSec' | 'initialOpacity'>): void {
    // Find a free slot, or recycle the oldest
    let slot = -1;
    let oldestAge = -1;
    for (let i = 0; i < MAX_ENTRIES; i++) {
      if (!entries[i].active) { slot = i; break; }
      if (entries[i].ageSec > oldestAge) { oldestAge = entries[i].ageSec; slot = i; }
    }
    if (slot < 0) return;

    const e = entries[slot];
    e.active = true;
    e.paths = input.paths.slice(0, PATHS_PER_ENTRY);
    e.xPx = input.xPx;
    e.yPx = input.yPx;
    e.scale = input.scale;
    e.rotationDeg = input.rotationDeg;
    e.opacity = input.opacity;
    e.initialOpacity = input.opacity;
    e.maxLifeSec = input.maxLifeSec;
    e.ageSec = 0;
    e.stroke = input.stroke;
  }

  function update(dt: number): void {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      const e = entries[i];
      if (!e.active) continue;

      e.ageSec += dt;
      e.opacity = e.initialOpacity * Math.max(0, 1 - e.ageSec / e.maxLifeSec);

      if (e.opacity < 0.005 || e.ageSec >= e.maxLifeSec) {
        e.active = false;
        domGroups[i].setAttribute('display', 'none');
      }
    }
  }

  function render(): void {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      const e = entries[i];
      const g = domGroups[i];

      if (!e.active) {
        if (g.getAttribute('display') !== 'none') {
          g.setAttribute('display', 'none');
        }
        continue;
      }

      g.removeAttribute('display');
      g.setAttribute(
        'transform',
        `translate(${e.xPx.toFixed(1)},${e.yPx.toFixed(1)}) ` +
        `rotate(${e.rotationDeg.toFixed(1)}) ` +
        `scale(${e.scale.toFixed(3)})`,
      );
      g.setAttribute('opacity', e.opacity.toFixed(3));

      const pathEls = g.children;
      for (let j = 0; j < PATHS_PER_ENTRY; j++) {
        const el = pathEls[j] as SVGPathElement;
        if (j < e.paths.length) {
          el.removeAttribute('display');
          el.setAttribute('d', e.paths[j].d);
          el.setAttribute('stroke', e.stroke);
          el.setAttribute('stroke-width', (e.paths[j].strokeWidth * 0.5).toFixed(2));
        } else {
          el.setAttribute('display', 'none');
        }
      }
    }
  }

  function activeCount(): number {
    let count = 0;
    for (const e of entries) if (e.active) count++;
    return count;
  }

  function destroy(): void {
    for (const g of domGroups) g.remove();
  }

  return { emit, update, render, activeCount, destroy };
}
