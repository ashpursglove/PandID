import { useEffect } from "react";

import { useDiagramStore } from "@/store/diagramStore";
import { useElectricalStore } from "@/electrical/store/electricalStore";
import { useDrawingsStore } from "@/store/drawingsStore";
import { useProjectStore } from "@/store/projectStore";

/**
 * Flags the project as dirty whenever the diagram, drawings, or company logo
 * changes. Initial state is never dirty; loads call `loadProjectMeta` /
 * `replace` which reset dirty, then these subscribers fire only for
 * subsequent mutations.
 */
export function useDirtyTracker() {
  useEffect(() => {
    let prev = {
      nodes: useDiagramStore.getState().nodes,
      edges: useDiagramStore.getState().edges,
    };
    const unsubDiagram = useDiagramStore.subscribe((state) => {
      if (state.nodes !== prev.nodes || state.edges !== prev.edges) {
        prev = { nodes: state.nodes, edges: state.edges };
        useProjectStore.getState().markDirty();
      }
    });

    let prevDrawings = {
      pages: useDrawingsStore.getState().pages,
      logo: useDrawingsStore.getState().companyLogo,
    };
    const unsubDrawings = useDrawingsStore.subscribe((state) => {
      if (
        state.pages !== prevDrawings.pages ||
        state.companyLogo !== prevDrawings.logo
      ) {
        prevDrawings = { pages: state.pages, logo: state.companyLogo };
        useProjectStore.getState().markDirty();
      }
    });
    let prevElec = {
      nodes: useElectricalStore.getState().nodes,
      edges: useElectricalStore.getState().edges,
    };
    const unsubElec = useElectricalStore.subscribe((state) => {
      if (state.nodes !== prevElec.nodes || state.edges !== prevElec.edges) {
        prevElec = { nodes: state.nodes, edges: state.edges };
        useProjectStore.getState().markDirty();
      }
    });
    return () => {
      unsubDiagram();
      unsubDrawings();
      unsubElec();
    };
  }, []);
}
