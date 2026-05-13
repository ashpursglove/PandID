/**
 * Centralised ID factory for diagram nodes, edges, and other ephemeral things
 * that need a process-unique handle. Pulled out of `Canvas.tsx` so the
 * diagram store can mint IDs too (e.g. for clipboard paste) without
 * duplicating the counter.
 *
 * IDs combine a millisecond timestamp (base-36) with a monotonic counter so
 * two IDs minted in the same tick still differ.
 */

let counter = 0;

export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function nextNodeId(): string {
  return nextId("n");
}

export function nextEdgeId(): string {
  return nextId("e");
}
