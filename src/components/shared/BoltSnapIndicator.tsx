import { ViewportPortal } from "@xyflow/react";

import type { SnapCandidate } from "./boltSnap";

/**
 * Highlight ring shown at the port a dragged component will bolt onto while it
 * is within snap range. Rendered through React Flow's ViewportPortal so it sits
 * in flow coordinates and tracks pan/zoom with the diagram.
 */
export function BoltSnapIndicator({
  candidate,
}: {
  candidate: SnapCandidate | null;
}) {
  if (!candidate) return null;
  return (
    <ViewportPortal>
      <div
        style={{
          position: "absolute",
          left: candidate.x,
          top: candidate.y,
          transform: "translate(-50%, -50%)",
          width: 20,
          height: 20,
          borderRadius: "9999px",
          border: "2px solid #34d399",
          background: "rgba(52, 211, 153, 0.18)",
          boxShadow: "0 0 8px rgba(52, 211, 153, 0.75)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />
    </ViewportPortal>
  );
}
