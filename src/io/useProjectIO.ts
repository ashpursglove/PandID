import { useCallback } from "react";

import { useDiagramStore } from "@/store/diagramStore";
import { useElectricalStore } from "@/electrical/store/electricalStore";
import { useProjectStore } from "@/store/projectStore";
import { useDrawingsStore } from "@/store/drawingsStore";
import { pushRecent } from "@/io/recentFiles";

import {
  makeProjectJson,
  parseProjectJson,
  pickAndReadFile,
  pickAndWriteFile,
  writeFileAt,
} from "./saveLoad";
import { exportPdf } from "./pdfExport";
import { exportDrawingsPdf } from "./drawingsPdf";
import { exportEquipmentCsv } from "./csvExport";

export function useProjectIO() {
  const newProject = useCallback(() => {
    const project = useProjectStore.getState();
    const diagram = useDiagramStore.getState();
    if (project.isDirty) {
      const confirmed = confirm(
        "You have unsaved changes. Start a new project anyway?",
      );
      if (!confirmed) return;
    }
    diagram.clear();
    project.resetToDefaults();
    useDrawingsStore.getState().clear();
    useElectricalStore.getState().clear();
    useDiagramStore.temporal.getState().clear();
    useElectricalStore.temporal.getState().clear();
  }, []);

  const openProject = useCallback(async () => {
    const project = useProjectStore.getState();
    if (project.isDirty) {
      const confirmed = confirm(
        "You have unsaved changes. Open another file anyway?",
      );
      if (!confirmed) return;
    }
    let picked;
    try {
      picked = await pickAndReadFile();
    } catch (e) {
      alert(`Could not open file: ${(e as Error).message}`);
      return;
    }
    if (!picked) return;

    try {
      const parsed = parseProjectJson(picked.content);
      useDiagramStore
        .getState()
        .replaceAll(parsed.diagram.nodes, parsed.diagram.edges);
      project.loadProjectMeta({
        meta: parsed.meta,
        fluids: parsed.fluids,
        filePath: picked.path,
      });
      useDrawingsStore.getState().replace(parsed.drawings ?? [], parsed.companyLogo ?? null);
      useElectricalStore
        .getState()
        .replaceAll(parsed.electrical?.nodes ?? [], parsed.electrical?.edges ?? []);
      useDiagramStore.temporal.getState().clear();
      useElectricalStore.temporal.getState().clear();
      pushRecent(picked.path);
    } catch (e) {
      alert(`Failed to load project: ${(e as Error).message}`);
    }
  }, []);

  /**
   * Import another save file's P&ID and SLD *into* the current document. Unlike
   * Open (which replaces everything), this merges: the imported parts are
   * re-ID'd, floated above the existing content with a gap, and pre-selected so
   * they can be dragged into place. Project meta / drawings are left untouched.
   */
  const importProject = useCallback(async () => {
    let picked;
    try {
      picked = await pickAndReadFile();
    } catch (e) {
      alert(`Could not import file: ${(e as Error).message}`);
      return;
    }
    if (!picked) return;

    try {
      const parsed = parseProjectJson(picked.content);
      const pidNodes = parsed.diagram?.nodes ?? [];
      const pidEdges = parsed.diagram?.edges ?? [];
      const elecNodes = parsed.electrical?.nodes ?? [];
      const elecEdges = parsed.electrical?.edges ?? [];

      if (pidNodes.length === 0 && elecNodes.length === 0) {
        alert("That file has no P&ID or SLD parts to import.");
        return;
      }

      useDiagramStore.getState().importGraph(pidNodes, pidEdges);
      useElectricalStore.getState().importGraph(elecNodes, elecEdges);
    } catch (e) {
      alert(`Failed to import project: ${(e as Error).message}`);
    }
  }, []);

  const saveAs = useCallback(async () => {
    const { meta, fluids, filePath: existing } = useProjectStore.getState();
    const { nodes, edges } = useDiagramStore.getState();
    const { pages: drawings, companyLogo } = useDrawingsStore.getState();
    const { nodes: electricalNodes, edges: electricalEdges } =
      useElectricalStore.getState();
    const json = makeProjectJson({
      meta,
      fluids,
      nodes,
      edges,
      drawings,
      companyLogo,
      electricalNodes,
      electricalEdges,
    });
    const path = await pickAndWriteFile(existing, json);
    if (!path) return;
    useProjectStore.getState().setFilePath(path);
    useProjectStore.getState().markClean();
    pushRecent(path);
  }, []);

  const save = useCallback(async () => {
    const { meta, fluids, filePath } = useProjectStore.getState();
    const { nodes, edges } = useDiagramStore.getState();
    const { pages: drawings, companyLogo } = useDrawingsStore.getState();
    const { nodes: electricalNodes, edges: electricalEdges } =
      useElectricalStore.getState();
    if (!filePath) {
      await saveAs();
      return;
    }
    const json = makeProjectJson({
      meta,
      fluids,
      nodes,
      edges,
      drawings,
      companyLogo,
      electricalNodes,
      electricalEdges,
    });
    try {
      await writeFileAt(filePath, json);
      useProjectStore.getState().markClean();
      pushRecent(filePath);
    } catch (e) {
      alert(`Failed to save: ${(e as Error).message}`);
    }
  }, [saveAs]);

  const openRecent = useCallback(async (path: string) => {
    const project = useProjectStore.getState();
    if (project.isDirty) {
      const confirmed = confirm(
        "You have unsaved changes. Open another file anyway?",
      );
      if (!confirmed) return;
    }
    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const content = await readTextFile(path);
      const parsed = parseProjectJson(content);
      useDiagramStore
        .getState()
        .replaceAll(parsed.diagram.nodes, parsed.diagram.edges);
      project.loadProjectMeta({
        meta: parsed.meta,
        fluids: parsed.fluids,
        filePath: path,
      });
      useDrawingsStore
        .getState()
        .replace(parsed.drawings ?? [], parsed.companyLogo ?? null);
      useElectricalStore
        .getState()
        .replaceAll(parsed.electrical?.nodes ?? [], parsed.electrical?.edges ?? []);
      useDiagramStore.temporal.getState().clear();
      useElectricalStore.temporal.getState().clear();
      pushRecent(path);
    } catch (e) {
      alert(`Failed to open recent file: ${(e as Error).message}`);
    }
  }, []);

  /**
   * Smart Export PDF — if the Drawings tab has pages set up, emit the full
   * multi-page set. Otherwise fall back to the legacy single-page export of
   * the current diagram (handy for quick "just dump my P&ID" use cases).
   */
  const exportPdfNow = useCallback(async () => {
    const { meta } = useProjectStore.getState();
    const { nodes, edges } = useDiagramStore.getState();
    const { pages, companyLogo } = useDrawingsStore.getState();
    try {
      if (pages.length > 0) {
        await exportDrawingsPdf({
          pages,
          meta,
          liveNodes: nodes,
          liveEdges: edges,
          companyLogo,
        });
      } else {
        await exportPdf({ nodes, edges, meta });
      }
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : typeof e === "string"
            ? e
            : String(e);
      alert(`PDF export failed: ${msg}`);
    }
  }, []);

  const exportCsvNow = useCallback(async () => {
    const { nodes } = useDiagramStore.getState();
    const { meta } = useProjectStore.getState();
    const base = (meta.drawingNumber || "equipment-list").replace(
      /[\\/:*?"<>|]/g,
      "_",
    );
    try {
      await exportEquipmentCsv(nodes, `${base}.csv`);
    } catch (e) {
      alert(`CSV export failed: ${(e as Error).message}`);
    }
  }, []);

  return {
    newProject,
    openProject,
    importProject,
    save,
    saveAs,
    openRecent,
    exportPdf: exportPdfNow,
    exportCsv: exportCsvNow,
  };
}
