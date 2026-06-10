/**
 * Phase helpers + colours. Single-phase components and feeders are drawn green
 * so a single-line diagram reads its phasing at a glance; three-phase keeps the
 * default ink/zinc. The same rules drive both the live editor and the baked
 * drawing/PDF output, so a captured view matches what the user designed.
 */

export type Phase = 1 | 3;

/** Green for single-phase glyphs / cables on the dark editor canvas. */
export const PHASE1_EDITOR = "#4ade40";
/** Darker green for single-phase ink on the white drawing sheet / PDF. */
export const PHASE1_PRINT = "#15803d";

interface PhaseBearing {
  data?: { params?: Record<string, unknown> | undefined } | undefined;
}

/**
 * Phase of a component, or `null` when the symbol has no phase concept
 * (busbars, instruments, transformers…). Resolved from an explicit `phases`
 * parameter where present, otherwise inferred from a switching/protection
 * device's `poles` (1P / 1P+N / 2P read as single-phase; 3P / 3P+N / 4P as
 * three-phase) so single-phase isolators, MCBs and RCBOs colour green too.
 */
export function nodePhase(node: PhaseBearing | undefined | null): Phase | null {
  const params = node?.data?.params;
  const p = params?.phases;
  if (p === "1" || p === 1) return 1;
  if (p === "3" || p === 3) return 3;
  const poles = params?.poles;
  if (typeof poles === "string") {
    if (/^(1P|2P)/.test(poles)) return 1;
    if (/^(3P|4P)/.test(poles)) return 3;
  }
  return null;
}

/**
 * Phase a power feeder carries. Single-phase if either endpoint is an
 * explicitly single-phase component, otherwise inferred from the cable
 * construction. Non-power links (control / earth / DC / bolted) return `null`
 * so they keep their own conventional colours.
 */
export function powerFeederPhase(
  connectionType: string | undefined,
  presetId: string | undefined,
  endpointPhases: (Phase | null)[],
): Phase | null {
  const ct = connectionType ?? "lv-power";
  if (ct !== "lv-power" && ct !== "mv-power") return null;
  if (endpointPhases.includes(1)) return 1;
  if (endpointPhases.includes(3)) return 3;
  if (presetId && /^ac-1p/.test(presetId)) return 1;
  if (presetId && /^ac-3p/.test(presetId)) return 3;
  return null;
}

/** Convenience wrapper resolving a feeder's phase from its endpoint nodes. */
export function feederPhase(
  edge: {
    data?:
      | { connectionType?: string; cable?: { presetId?: string } | undefined }
      | undefined;
  },
  src: PhaseBearing | undefined | null,
  tgt: PhaseBearing | undefined | null,
): Phase | null {
  return powerFeederPhase(
    edge.data?.connectionType,
    edge.data?.cable?.presetId,
    [nodePhase(src), nodePhase(tgt)],
  );
}
