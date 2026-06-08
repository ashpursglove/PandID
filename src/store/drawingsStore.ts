import { create } from "zustand";

import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import type { ElecEdge, ElecNode } from "@/electrical/store/electricalStore";
import type { ProjectMeta } from "@/store/projectStore";
import type { SinglePathResult } from "@/engine/types";

/* ------------------------------ Page types ------------------------------ */

export type DrawingPageType =
  | "diagram"
  | "sld"
  | "analysis"
  | "bom"
  | "elec-schedule"
  | "title"
  | "blank";

/** Content for a title / section divider page: big wrapped heading + subtitle. */
export interface TitlePageContent {
  heading: string;
  subheading?: string;
}

export interface DiagramView {
  /** World-space rectangle (in flow coords) captured from the editor viewport. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Frozen snapshot of the diagram at capture time so the page is reproducible
   *  even if the user keeps editing the live drawing afterwards. */
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** Frozen snapshot of an electrical single-line diagram view. */
export interface SldView {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  nodes: ElecNode[];
  edges: ElecEdge[];
}

export interface AnalysisSnapshot {
  startId: string;
  endId: string;
  startLabel: string;
  endLabel: string;
  fluidName: string;
  mode: "forward" | "inverse";
  targetQM3h?: number;
  result: SinglePathResult;
  /** Frozen diagram snapshot used to draw the route preview on the page so it
   *  stays accurate even if the live diagram is edited later. */
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** IDs of the nodes / edges that lie on the analysed path (for highlighting
   *  in the route preview). */
  pathNodeIds: string[];
  pathEdgeIds: string[];
  /** When an analysis is too long to fit on a single sheet, the breakdown is
   *  split across multiple consecutive pages. These describe which slice of
   *  `result.components` this page is responsible for and where it sits in
   *  the set. The first page (pageIndex 0) carries the full layout — route
   *  preview, KPI cards, warnings — and every continuation page only renders
   *  the per-component table for its slice. */
  pageIndex?: number;
  totalPages?: number;
  componentSlice?: { start: number; end: number };
}

export interface BomConfig {
  /** Include pipe segments grouped by material/size in addition to equipment. */
  includePipes: boolean;
}

/** Frozen snapshot used to render an electrical schedule / BOM as a drawing
 *  sheet. The table is rebuilt from this snapshot at render time so the page
 *  stays reproducible even if the live SLD changes afterwards. */
export interface ElecScheduleSnapshot {
  kind: "loads" | "cables" | "bom";
  nodes: ElecNode[];
  edges: ElecEdge[];
  /** When the table is too long for one sheet it is split across consecutive
   *  pages. Each page renders only its slice of the (deterministically rebuilt)
   *  layout. Absent / 0 means a single sheet. */
  pageIndex?: number;
  totalPages?: number;
}

export type AnnotationKind = "text" | "note" | "arrow";

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  /** Position in millimetres relative to the page top-left. */
  x: number;
  y: number;
  /** For arrows: endpoint relative to the page top-left. */
  x2?: number;
  y2?: number;
  text?: string;
  /** Font size in mm. Defaults vary by kind. */
  fontSize?: number;
}

export interface DrawingPage {
  id: string;
  /** Human-readable name shown in the sidebar (e.g. "Process flow — sheet 1"). */
  title: string;
  type: DrawingPageType;
  /**
   * Per-page overrides for the title block fields. Anything left undefined
   * here falls back to the live project meta when rendering, so global
   * properties (drawn by, approved by, …) propagate automatically.
   */
  titleBlock: Partial<ProjectMeta>;
  diagram?: DiagramView;
  sld?: SldView;
  analysis?: AnalysisSnapshot;
  bom?: BomConfig;
  elecSchedule?: ElecScheduleSnapshot;
  titlePage?: TitlePageContent;
  annotations: Annotation[];
  /** Per-page colour overrides for individual diagram elements, keyed by
   *  node.id or edge.id. Anything not present falls back to the default print
   *  colour. Lets users colour-code a sheet (e.g. red for the hot-water
   *  loop) without touching the live diagram. */
  colorOverrides?: Record<string, string>;
  /** Per-edge line-thickness multiplier (1.0 = default), keyed by edge.id.
   *  Lets users emphasise a critical path on a printed drawing without
   *  changing the live diagram. */
  widthOverrides?: Record<string, number>;
}

interface DrawingsState {
  pages: DrawingPage[];
  selectedPageId: string | null;
  /** Optional company logo as a data URL (or null = no logo). */
  companyLogo: string | null;

  /* ----- selection & CRUD ----- */
  selectPage: (id: string | null) => void;
  addPage: (page: DrawingPage) => void;
  removePage: (id: string) => void;
  movePage: (id: string, dir: -1 | 1) => void;
  duplicatePage: (id: string) => void;
  updatePage: (id: string, patch: Partial<DrawingPage>) => void;
  updateTitleBlock: (id: string, patch: Partial<ProjectMeta>) => void;
  renamePage: (id: string, title: string) => void;

  /* ----- annotations ----- */
  addAnnotation: (pageId: string, ann: Annotation) => void;
  updateAnnotation: (pageId: string, annId: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (pageId: string, annId: string) => void;

  /* ----- per-page colour overrides ----- */
  /** Set `color = null` to clear the override and return the element to the
   *  default print colour. */
  setColorOverride: (pageId: string, elementId: string, color: string | null) => void;
  clearAllColorOverrides: (pageId: string) => void;

  /* ----- per-page line-width overrides (edges only) ----- */
  /** Set `multiplier = null` to clear and return to the default thickness. */
  setWidthOverride: (pageId: string, edgeId: string, multiplier: number | null) => void;
  clearAllWidthOverrides: (pageId: string) => void;

  /* ----- logo ----- */
  setCompanyLogo: (logo: string | null) => void;

  /* ----- bulk ops (load / new) ----- */
  replace: (pages: DrawingPage[], logo: string | null) => void;
  clear: () => void;
}

let pageCounter = 0;
function genPageId() {
  pageCounter += 1;
  return `pg-${Date.now().toString(36)}-${pageCounter}`;
}

export function newPageId() {
  return genPageId();
}

export function newAnnotationId() {
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useDrawingsStore = create<DrawingsState>((set) => ({
  pages: [],
  selectedPageId: null,
  companyLogo: null,

  selectPage: (id) => set({ selectedPageId: id }),

  addPage: (page) =>
    set((s) => ({
      pages: [...s.pages, page],
      selectedPageId: page.id,
    })),

  removePage: (id) =>
    set((s) => {
      const idx = s.pages.findIndex((p) => p.id === id);
      if (idx === -1) return s;
      const pages = s.pages.filter((p) => p.id !== id);
      let nextSel: string | null = null;
      if (s.selectedPageId === id) {
        nextSel = pages[Math.min(idx, pages.length - 1)]?.id ?? null;
      } else {
        nextSel = s.selectedPageId;
      }
      return { pages, selectedPageId: nextSel };
    }),

  movePage: (id, dir) =>
    set((s) => {
      const idx = s.pages.findIndex((p) => p.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= s.pages.length) return s;
      const pages = s.pages.slice();
      const [page] = pages.splice(idx, 1);
      pages.splice(target, 0, page);
      return { pages };
    }),

  duplicatePage: (id) =>
    set((s) => {
      const src = s.pages.find((p) => p.id === id);
      if (!src) return s;
      const idx = s.pages.findIndex((p) => p.id === id);
      const clone: DrawingPage = {
        ...src,
        id: genPageId(),
        title: `${src.title} (copy)`,
        annotations: src.annotations.map((a) => ({ ...a })),
      };
      const pages = s.pages.slice();
      pages.splice(idx + 1, 0, clone);
      return { pages, selectedPageId: clone.id };
    }),

  updatePage: (id, patch) =>
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  updateTitleBlock: (id, patch) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === id ? { ...p, titleBlock: { ...p.titleBlock, ...patch } } : p,
      ),
    })),

  renamePage: (id, title) =>
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? { ...p, title } : p)),
    })),

  addAnnotation: (pageId, ann) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, annotations: [...p.annotations, ann] } : p,
      ),
    })),

  updateAnnotation: (pageId, annId, patch) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              annotations: p.annotations.map((a) =>
                a.id === annId ? { ...a, ...patch } : a,
              ),
            }
          : p,
      ),
    })),

  removeAnnotation: (pageId, annId) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId
          ? { ...p, annotations: p.annotations.filter((a) => a.id !== annId) }
          : p,
      ),
    })),

  setColorOverride: (pageId, elementId, color) =>
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.id !== pageId) return p;
        const next = { ...(p.colorOverrides ?? {}) };
        if (color == null) {
          delete next[elementId];
        } else {
          next[elementId] = color;
        }
        return { ...p, colorOverrides: next };
      }),
    })),

  clearAllColorOverrides: (pageId) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, colorOverrides: {} } : p,
      ),
    })),

  setWidthOverride: (pageId, edgeId, multiplier) =>
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.id !== pageId) return p;
        const next = { ...(p.widthOverrides ?? {}) };
        if (multiplier == null) {
          delete next[edgeId];
        } else {
          next[edgeId] = multiplier;
        }
        return { ...p, widthOverrides: next };
      }),
    })),

  clearAllWidthOverrides: (pageId) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, widthOverrides: {} } : p,
      ),
    })),

  setCompanyLogo: (logo) => set({ companyLogo: logo }),

  replace: (pages, logo) =>
    set({
      pages,
      companyLogo: logo,
      selectedPageId: pages[0]?.id ?? null,
    }),

  clear: () => set({ pages: [], selectedPageId: null, companyLogo: null }),
}));

/* ---------------------------- selector helpers ---------------------------- */

export function useSelectedDrawingPage(): DrawingPage | null {
  return useDrawingsStore((s) =>
    s.selectedPageId
      ? s.pages.find((p) => p.id === s.selectedPageId) ?? null
      : null,
  );
}
