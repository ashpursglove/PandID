import type { ElecNode } from "@/electrical/store/electricalStore";

/**
 * Next available tag for a given prefix on the SLD, e.g. "Q" → "Q-101".
 * Convention: prefix + dash + number starting at 101, matching the P&ID side.
 */
export function nextElecTag(prefix: string, nodes: ElecNode[]): string {
  const re = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);
  let maxN = 100;
  for (const n of nodes) {
    const t = (n.data.tag ?? "") as string;
    const m = re.exec(t);
    if (m) {
      const v = Number.parseInt(m[1], 10);
      if (v > maxN) maxN = v;
    }
  }
  return `${prefix}-${maxN + 1}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
