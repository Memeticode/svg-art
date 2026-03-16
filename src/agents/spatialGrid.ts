// ── Spatial grid: fast neighbor queries for agent clustering ──

import type { MorphAgent } from './MorphAgent';

const GRID_SIZE = 10;
const CELL_SIZE = 1.0 / GRID_SIZE;

export interface SpatialGrid {
  rebuild(agents: MorphAgent[]): void;
  getNeighbors(xNorm: number, yNorm: number, radius: number): MorphAgent[];
}

export function createSpatialGrid(): SpatialGrid {
  // Flat array of cells, each holding agent references
  const cells: MorphAgent[][] = [];
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    cells.push([]);
  }

  function cellIndex(xNorm: number, yNorm: number): number {
    const col = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(xNorm / CELL_SIZE)));
    const row = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(yNorm / CELL_SIZE)));
    return row * GRID_SIZE + col;
  }

  function rebuild(agents: MorphAgent[]): void {
    for (let i = 0; i < cells.length; i++) {
      cells[i].length = 0;
    }
    for (const agent of agents) {
      if (!agent.alive) continue;
      const idx = cellIndex(agent.xNorm, agent.yNorm);
      cells[idx].push(agent);
    }
  }

  function getNeighbors(xNorm: number, yNorm: number, radius: number): MorphAgent[] {
    const result: MorphAgent[] = [];
    const r2 = radius * radius;

    const colMin = Math.max(0, Math.floor((xNorm - radius) / CELL_SIZE));
    const colMax = Math.min(GRID_SIZE - 1, Math.floor((xNorm + radius) / CELL_SIZE));
    const rowMin = Math.max(0, Math.floor((yNorm - radius) / CELL_SIZE));
    const rowMax = Math.min(GRID_SIZE - 1, Math.floor((yNorm + radius) / CELL_SIZE));

    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        const cell = cells[row * GRID_SIZE + col];
        for (const agent of cell) {
          const dx = agent.xNorm - xNorm;
          const dy = agent.yNorm - yNorm;
          if (dx * dx + dy * dy <= r2) {
            result.push(agent);
          }
        }
      }
    }

    return result;
  }

  return { rebuild, getNeighbors };
}
