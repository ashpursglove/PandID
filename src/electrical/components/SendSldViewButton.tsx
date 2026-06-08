import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { ImagePlus } from "lucide-react";

import { useElectricalStore } from "@/electrical/store/electricalStore";
import { useDrawingsStore, newPageId } from "@/store/drawingsStore";

interface Props {
  className?: string;
}

/**
 * Captures the current SLD viewport as a new "sld" page in the Drawings tab,
 * freezing a snapshot of the nodes + edges so the sheet stays stable even if
 * the live diagram changes afterwards. Mirrors the P&ID SendCurrentViewButton.
 */
export function SendSldViewButton({ className }: Props) {
  const flow = useReactFlow();
  const addPage = useDrawingsStore((s) => s.addPage);
  const pages = useDrawingsStore((s) => s.pages);
  const [confirming, setConfirming] = useState(false);

  const onClick = useCallback(() => {
    const nodes = useElectricalStore.getState().nodes;
    const edges = useElectricalStore.getState().edges;
    if (nodes.length === 0) {
      alert("Nothing to send — drop some SLD components on the canvas first.");
      return;
    }

    const viewport = flow.getViewport();
    const pane = document.querySelector(".react-flow") as HTMLElement | null;
    const rect = pane?.getBoundingClientRect();
    const screenW = rect?.width ?? 1024;
    const screenH = rect?.height ?? 768;

    const minX = -viewport.x / viewport.zoom;
    const minY = -viewport.y / viewport.zoom;
    const maxX = minX + screenW / viewport.zoom;
    const maxY = minY + screenH / viewport.zoom;

    const idx = pages.filter((p) => p.type === "sld").length + 1;
    addPage({
      id: newPageId(),
      title: `Single-line diagram — sheet ${idx}`,
      type: "sld",
      titleBlock: {},
      sld: {
        bounds: { minX, minY, maxX, maxY },
        nodes: structuredClone(nodes),
        edges: structuredClone(edges),
      },
      annotations: [],
    });
    setConfirming(true);
    window.setTimeout(() => setConfirming(false), 1400);
  }, [addPage, flow, pages]);

  return (
    <button
      type="button"
      onClick={onClick}
      title="Capture the current SLD view as a new page in the Drawings tab"
      className={`absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-zinc-700 bg-[var(--color-panel)]/95 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 shadow-lg backdrop-blur transition hover:border-sky-500 hover:text-sky-200 ${className ?? ""}`}
    >
      <ImagePlus size={13} strokeWidth={1.75} />
      {confirming ? "Sent ✓" : "Send view to Drawings"}
    </button>
  );
}
