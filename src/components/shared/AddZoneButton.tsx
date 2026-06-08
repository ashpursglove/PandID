import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { SquareDashedBottom } from "lucide-react";

import { createZoneNode, type ZoneNode } from "./zone";

interface Props {
  /** Push the freshly-built zone node into the owning store. */
  onAdd: (node: ZoneNode) => void;
  className?: string;
}

/**
 * Drops a labelled area box in the middle of the current view. Shared by both
 * the P&ID and electrical editors.
 */
export function AddZoneButton({ onAdd, className }: Props) {
  const { screenToFlowPosition } = useReactFlow();

  const onClick = useCallback(() => {
    const pane = document.querySelector(".react-flow") as HTMLElement | null;
    const rect = pane?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const center = screenToFlowPosition({ x: cx, y: cy });
    onAdd(createZoneNode(center));
  }, [onAdd, screenToFlowPosition]);

  return (
    <button
      type="button"
      onClick={onClick}
      title="Add a labelled area box behind the diagram"
      className={`absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-zinc-700 bg-[var(--color-panel)]/95 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 shadow-lg backdrop-blur transition hover:border-sky-500 hover:text-sky-200 ${className ?? ""}`}
    >
      <SquareDashedBottom size={13} strokeWidth={1.75} />
      Add area
    </button>
  );
}
