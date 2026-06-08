/**
 * Shared feeder routing so the live editor (FeederEdge) and the static Drawings
 * renderer (sldRender) stagger parallel connections identically.
 *
 * A smooth-step edge jogs at a "center" point — by default the midpoint between
 * the two handles. When several feeders share that midpoint (e.g. a busbar
 * fanning out to loads sitting on the same level) their horizontal runs land on
 * top of each other. We push each feeder's jog to its own corridor by nudging
 * the center point a distinct amount per edge index, clamped to stay between
 * the two endpoints so the path keeps a clean orthogonal step.
 */

/** Symmetric spread of corridor offsets (flow units), distinct per edge. */
const CORRIDOR_DELTAS = [0, 14, -14, 28, -28, 42, -42, 21, -21, 35, -35];

export function feederCorridorDelta(index: number): number {
  const i = index < 0 ? 0 : index;
  return CORRIDOR_DELTAS[i % CORRIDOR_DELTAS.length];
}

function clampBetween(value: number, a: number, b: number, margin: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo <= margin * 2) return (lo + hi) / 2; // too tight to stagger
  return Math.max(lo + margin, Math.min(hi - margin, value));
}

/**
 * Per-edge center point for `getSmoothStepPath`, staggered so parallel feeders
 * occupy separate corridors instead of overlapping.
 */
export function feederCenter(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  index: number,
): { centerX: number; centerY: number } {
  const delta = feederCorridorDelta(index);
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  return {
    centerX: clampBetween(midX + delta, sourceX, targetX, 6),
    centerY: clampBetween(midY + delta, sourceY, targetY, 6),
  };
}
