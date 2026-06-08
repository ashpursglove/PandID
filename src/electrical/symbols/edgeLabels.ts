/** Default vertical gap between feeder tag and cable spec label (flow units). */
export const SPEC_LABEL_BELOW_TAG_Y = 14;

/** Resolved cable-spec label offset from the feeder path midpoint. */
export function specLabelOffset(
  hasTag: boolean,
  stored?: { x: number; y: number },
): { x: number; y: number } {
  if (stored) return stored;
  return hasTag ? { x: 0, y: SPEC_LABEL_BELOW_TAG_Y } : { x: 0, y: 0 };
}
