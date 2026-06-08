/**
 * "Bolt schedule" derivation. When breakers / MCCBs etc. are bolted directly
 * onto a distribution board or busbar (a no-cable "direct" connection), drawing
 * each one's tag next to the symbol quickly turns into an unreadable pile of
 * overlapping labels. Instead we hide those tags on the symbols and gather them
 * into a small schedule table shown beside the parent board/bus.
 *
 * Pure functions — the editor overlay and the SVG exporter share these.
 */

import { getElecSymbol } from "@/electrical/symbols/registry";
import type { ElecEdge, ElecNode } from "@/electrical/store/electricalStore";

/** A board / busbar — the things bolted components hang off. */
export function isContainerNode(node: ElecNode): boolean {
  const sym = getElecSymbol(node.data.symbolType);
  return sym?.engineModel === "board" || sym?.engineModel === "busbar";
}

function isDirect(e: ElecEdge): boolean {
  return (e.data?.connectionType ?? "lv-power") === "direct";
}

export interface BoltTableRow {
  /** Outgoing way / tap label, e.g. "1", or "IN" for the incomer. */
  tap: string;
  tag: string;
  type: string;
  rating: string;
}

function prettyTap(handle: string | null | undefined): string {
  if (!handle) return "—";
  if (handle === "in") return "IN";
  const m = /^t(\d+)$/.exec(handle);
  return m ? m[1] : handle;
}

function tapOrder(handle: string | null | undefined): number {
  if (handle === "in") return -1;
  const m = /^t(\d+)$/.exec(handle ?? "");
  return m ? Number(m[1]) : 9999;
}

function formatRating(node: ElecNode): string {
  const p = (node.data.params ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  const amps = Number(p.ratedCurrentA);
  if (Number.isFinite(amps) && amps > 0) parts.push(`${amps} A`);
  const fuse = Number(p.fuseRatingA);
  if (Number.isFinite(fuse) && fuse > 0) parts.push(`${fuse} A fuse`);
  if (typeof p.poles === "string" && p.poles) parts.push(p.poles);
  if (typeof p.type === "string" && p.type) parts.push(p.type);
  return parts.join(" · ");
}

/**
 * Rows for the schedule beside `parentId`: every component bolted onto it,
 * ordered by tap. Returns [] when nothing is bolted on.
 */
export function buildBoltTableRows(
  parentId: string,
  nodes: ElecNode[],
  edges: ElecEdge[],
): BoltTableRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rows: { row: BoltTableRow; order: number }[] = [];
  for (const e of edges) {
    if (!isDirect(e)) continue;
    let childId: string | undefined;
    let parentHandle: string | null | undefined;
    if (e.source === parentId) {
      childId = e.target;
      parentHandle = e.sourceHandle;
    } else if (e.target === parentId) {
      childId = e.source;
      parentHandle = e.targetHandle;
    } else {
      continue;
    }
    const child = byId.get(childId);
    if (!child) continue;
    const sym = getElecSymbol(child.data.symbolType);
    rows.push({
      order: tapOrder(parentHandle),
      row: {
        tap: prettyTap(parentHandle),
        tag: (child.data.tag as string) || (child.data.label as string) || "",
        type: sym?.label ?? child.data.symbolType,
        rating: formatRating(child),
      },
    });
  }
  return rows.sort((a, b) => a.order - b.order).map((r) => r.row);
}

/**
 * Ids of components bolted onto a container — their tag is shown in the
 * container's table rather than on the symbol.
 */
export function boltedChildIds(
  nodes: ElecNode[],
  edges: ElecEdge[],
): Set<string> {
  const container = new Set(
    nodes.filter((n) => isContainerNode(n)).map((n) => n.id),
  );
  const out = new Set<string>();
  for (const e of edges) {
    if (!isDirect(e)) continue;
    const sIsC = container.has(e.source);
    const tIsC = container.has(e.target);
    if (sIsC && !tIsC) out.add(e.target);
    else if (tIsC && !sIsC) out.add(e.source);
  }
  return out;
}

/** True when this node's tag should be suppressed (it's bolted onto a board/bus). */
export function isBoltedChild(
  nodeId: string,
  nodes: ElecNode[],
  edges: ElecEdge[],
): boolean {
  return boltedChildIds(nodes, edges).has(nodeId);
}
