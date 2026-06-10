import { newPageId, useDrawingsStore } from "@/store/drawingsStore";
import { useDiagramStore } from "@/store/diagramStore";

/**
 * Adds a Bill-of-Materials page to the Drawings tab, built from the live P&ID.
 * Shared by the "Send BOM to Drawings" buttons in the P&ID Editor and the P&ID
 * Analysis tab so the action is identical wherever it's triggered. Returns
 * `false` (and warns) when the diagram is empty.
 */
export function sendPidBomToDrawings(): boolean {
  const nodes = useDiagramStore.getState().nodes;
  if (nodes.filter((n) => n.data?.symbolType).length === 0) {
    alert("Nothing to list — drop some equipment on the P&ID first.");
    return false;
  }
  useDrawingsStore.getState().addPage({
    id: newPageId(),
    title: "Bill of Materials",
    type: "bom",
    titleBlock: {},
    annotations: [],
    bom: { includePipes: true },
  });
  return true;
}
