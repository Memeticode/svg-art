// Flow-to-stroke interaction mappings.
// Each interaction maps a flow component (vector: angle + magnitude) to a stroke parameter.

import type { FlowSample, FlowVector, FlowInteraction, CurveAgent } from './schema';

/** Apply all active interactions to mutate agent state based on flow sample. */
export function applyInteractions(
  agent: CurveAgent,
  flow: FlowSample,
  interactions: FlowInteraction[],
  dt: number,
): void {
  for (const interaction of interactions) {
    const vec = readSource(flow, interaction.source);
    const strength = interaction.strength;
    if (vec.magnitude * strength < 0.001) continue;

    applyToTarget(agent, interaction.target, vec, strength, dt);
  }
}

function readSource(flow: FlowSample, source: FlowInteraction['source']): FlowVector {
  return flow[source];
}

function applyToTarget(
  agent: CurveAgent,
  target: FlowInteraction['target'],
  vec: FlowVector,
  strength: number,
  dt: number,
): void {
  switch (target) {
    case 'drift': {
      // Flow vector biases drift velocity along its direction
      const push = vec.magnitude * strength * 0.002 * dt;
      agent.driftA += Math.cos(vec.angle) * push;
      agent.driftB += Math.sin(vec.angle) * push;
      break;
    }
    case 'spread': {
      // Magnitude modulates edge widths; angle biases A vs B
      const delta = vec.magnitude * strength * 0.001 * dt;
      const bias = Math.cos(vec.angle);
      const dA = delta * (1 + bias) * 0.5;
      const dB = delta * (1 - bias) * 0.5;
      agent.edge1A += dA;
      agent.edge2A += dA;
      agent.edge1B += dB;
      agent.edge2B += dB;
      break;
    }
    case 'curvature': {
      // Curvature is read directly from flow in buildPath.
      // This interaction could adjust a curvature multiplier on the agent in the future.
      break;
    }
    case 'crossing': {
      // High magnitude pushes toward crossed state
      const crossPush = vec.magnitude * strength;
      agent.crossed = crossPush > 0.5;
      break;
    }
  }
}
