import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  MinusCircle,
  Palette,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import { useDiagramStore } from "@/store/diagramStore";
import { useProjectStore } from "@/store/projectStore";
import {
  newAnnotationId,
  useDrawingsStore,
  type Annotation,
  type DrawingPage,
  type SldView,
} from "@/store/drawingsStore";
import { renderDrawingPage } from "@/io/drawingsRender";
import { PAGE_H, PAGE_W } from "@/io/svgRender";
import { computeNoteBox } from "@/io/annotationLayout";
import { cn } from "@/lib/utils";
import {
  TextPromptModal,
  type TextPromptOptions,
} from "@/components/Drawings/TextPromptModal";

/* ----- element selection (pipes / components in diagram pages) --------- */

interface SelectedElement {
  id: string;
  kind: "node" | "edge";
}

/**
 * Black crosshair for text / note / arrow placement. OS-provided cursors
 * often follow `prefers-color-scheme` and render light on dark-app shells —
 * nearly invisible on the white A3 sheet. A custom bitmap/SVG cursor stays
 * dark everywhere; the fallback is still `crosshair` on older engines.
 */
const PLACEMENT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M16 4v8M16 20v8M4 16h8M20 16h8"/></g><circle cx="16" cy="16" r="2" fill="#000"/></svg>',
)}") 16 16, crosshair`;

// The OS "grab"/"grabbing" cursors are often a near-white hand that vanishes
// against the white drawing sheet. These custom dark cursors (black fill +
// white outline) stay visible on any background. The idle one is a normal
// arrow so clicking still feels natural; the active-pan one is a four-way move.
const ARROW_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5 3 L5 19 L9.5 14.7 L12.3 21 L15 19.8 L12.2 13.9 L18 13.6 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>',
)}") 5 3, default`;
const PAN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M14 2 L18 6 H15 V13 H22 V10 L26 14 L22 18 V15 H15 V22 H18 L14 26 L10 22 H13 V15 H6 V18 L2 14 L6 10 V13 H13 V6 H10 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>',
)}") 14 14, grabbing`;

const COLOR_PALETTE: { label: string; value: string }[] = [
  { label: "Black", value: "#000000" },
  { label: "Slate", value: "#334155" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Amber", value: "#d97706" },
  { label: "Green", value: "#16a34a" },
  { label: "Teal", value: "#0d9488" },
  { label: "Sky", value: "#0284c7" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
];

interface Props {
  page: DrawingPage;
  pageNumber: number;
  totalPages: number;
}

type ToolMode = "select" | "text" | "note" | "arrow";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 6;

/* ----- annotation geometry (visible bounding box, in page-mm coords) ----- */

interface VBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function annotationBox(ann: Annotation): VBox {
  if (ann.kind === "text") {
    const fontSize = ann.fontSize ?? 4;
    // Annotation text is rendered with dominant-baseline:hanging, so the text
    // begins at (x, y) and extends down-right.
    const charW = fontSize * 0.55;
    const w = Math.max(6, (ann.text?.length ?? 0) * charW);
    return { x: ann.x, y: ann.y, w, h: fontSize + 1 };
  }
  if (ann.kind === "note") {
    const fontSize = ann.fontSize ?? 3.2;
    const { w, h } = computeNoteBox(ann.text ?? "", fontSize);
    return { x: ann.x, y: ann.y, w, h };
  }
  // arrow
  const x2 = ann.x2 ?? ann.x;
  const y2 = ann.y2 ?? ann.y;
  return {
    x: Math.min(ann.x, x2) - 1,
    y: Math.min(ann.y, y2) - 1,
    w: Math.abs(x2 - ann.x) + 2,
    h: Math.abs(y2 - ann.y) + 2,
  };
}

/** Map a pointer event to SVG-mm coordinates using the inverse of the SVG's
 *  CTM. Works regardless of the page's current zoom/pan transform. */
function pageCoordsFrom(e: MouseEvent | React.MouseEvent, svg: SVGSVGElement) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inv = ctm.inverse();
  const local = pt.matrixTransform(inv);
  return { x: local.x, y: local.y };
}

/* ------------------------------------------------------------------------- */

export function PagePreview({ page, pageNumber, totalPages }: Props) {
  const meta = useProjectStore((s) => s.meta);
  const liveNodes = useDiagramStore((s) => s.nodes);
  const liveEdges = useDiagramStore((s) => s.edges);
  const companyLogo = useDrawingsStore((s) => s.companyLogo);
  const addAnnotation = useDrawingsStore((s) => s.addAnnotation);
  const updateAnnotation = useDrawingsStore((s) => s.updateAnnotation);
  const removeAnnotation = useDrawingsStore((s) => s.removeAnnotation);
  const setColorOverride = useDrawingsStore((s) => s.setColorOverride);
  const clearAllColorOverrides = useDrawingsStore(
    (s) => s.clearAllColorOverrides,
  );
  const setWidthOverride = useDrawingsStore((s) => s.setWidthOverride);
  const clearAllWidthOverrides = useDrawingsStore(
    (s) => s.clearAllWidthOverrides,
  );

  const [tool, setTool] = useState<ToolMode>("select");
  const [arrowDraft, setArrowDraft] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);

  // Open modal state + a promise-returning helper so callers can `await`
  // user input instead of dealing with browser `prompt()` flow.
  const [promptState, setPromptState] = useState<
    (TextPromptOptions & { resolve: (value: string | null) => void }) | null
  >(null);

  function askText(opts: TextPromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      setPromptState({ ...opts, resolve });
    });
  }

  // Diagram (P&ID) and SLD pages render selectable nodes/edges that can be
  // recoloured / re-weighted; analysis pages have their own (read-only)
  // styling, BOM/schedule pages are pure text, etc.
  const elementSelectable = page.type === "diagram" || page.type === "sld";

  // Clear any stale element selection whenever the visible page or page type
  // changes, so leftover selection state can't bleed across sheets.
  useEffect(() => {
    setSelectedElement(null);
  }, [page.id, page.type]);

  // Zoom & pan: pixel-space transform applied to the page wrapper with
  // transform-origin at the top-left so the inverse math stays trivial.
  // `pageSize` is the natural (zoom=1) size of the page wrapper, computed to
  // fit the viewport with a small margin.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Refs let the wheel handler reach the latest state without re-registering
  // its listener on every frame.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const baseSvg = useMemo(
    () =>
      renderDrawingPage(page, {
        meta,
        liveNodes,
        liveEdges,
        companyLogo,
        pageNumber,
        totalPages,
        omitAnnotations: true,
      }),
    [page, meta, liveNodes, liveEdges, companyLogo, pageNumber, totalPages],
  );

  // Compute the wrapper's natural size to fit the viewport with a 6% margin,
  // re-running on viewport resize so window resizes feel native.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 24; // px
      const maxW = rect.width - margin * 2;
      const maxH = rect.height - margin * 2;
      let w = maxW;
      let h = (w * PAGE_H) / PAGE_W;
      if (h > maxH) {
        h = maxH;
        w = (h * PAGE_W) / PAGE_H;
      }
      setPageSize({ w, h });
      // Re-center every time the viewport size changes (only when the user
      // hasn't zoomed; otherwise we preserve their position).
      if (zoomRef.current === 1) {
        setPan({ x: (rect.width - w) / 2, y: (rect.height - h) / 2 });
      }
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset zoom/pan on page change. Use a separate effect that runs after the
  // size measurement so initial centering uses the latest pageSize.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || pageSize.w === 0) return;
    setZoom(1);
    const rect = el.getBoundingClientRect();
    setPan({
      x: (rect.width - pageSize.w) / 2,
      y: (rect.height - pageSize.h) / 2,
    });
  }, [page.id, pageSize.w, pageSize.h]);

  // --- wheel zoom-to-cursor ------------------------------------------------
  // The wrapper's pixel size grows with zoom (`pageSize · zoom`) and its
  // top-left is at `pan` in viewport coords. A point on the un-zoomed page at
  // natural pixel coord P maps to viewport position `pan + P·zoom`, so the
  // inverse is `P = (m − pan) / zoom`. To keep the same P under the cursor at
  // a new zoom we solve for `pan' = m − (m − pan)·(zoom'/zoom)`.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(ev: WheelEvent) {
      if (!el) return;
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      // Cursor position relative to the viewport's top-left.
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const factor = Math.exp(-ev.deltaY * 0.0015);
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;
      const real = newZoom / oldZoom;
      const oldPan = panRef.current;
      const newPan = {
        x: mx - (mx - oldPan.x) * real,
        y: my - (my - oldPan.y) * real,
      };
      setZoom(newZoom);
      setPan(newPan);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // --- click-drag panning (left or middle button) ---
  // Left-drag pans the sheet just like the editor canvas. Because the same
  // left button is also used to select diagram elements, we only treat a drag
  // as a pan once it moves past a small threshold, and we suppress the
  // follow-up `click` so a pan never accidentally selects/deselects.
  const panState = useRef<{
    startX: number;
    startY: number;
    pan0: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const [panning, setPanning] = useState(false);
  // When true, the next element/annotation click is ignored (it was the tail
  // end of a pan, not an intentional click).
  const suppressClickRef = useRef(false);

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      const st = panState.current;
      if (!st) return;
      const dx = ev.clientX - st.startX;
      const dy = ev.clientY - st.startY;
      if (!st.moved && Math.hypot(dx, dy) < 4) return; // tolerate click jitter
      if (!st.moved) {
        st.moved = true;
        setPanning(true);
      }
      setPan({ x: st.pan0.x + dx, y: st.pan0.y + dy });
    }
    function onUp() {
      if (panState.current?.moved) suppressClickRef.current = true;
      panState.current = null;
      setPanning(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function onMouseDownViewport(ev: React.MouseEvent) {
    // Middle button always pans. Left button pans only in select mode — in a
    // placement mode (text/note/arrow) the left click is placing an annotation.
    const leftPan = ev.button === 0 && toolRef.current === "select";
    if (ev.button === 1 || leftPan) {
      // Stop the browser starting a text/element selection drag on the static
      // base SVG — otherwise panning highlights all the SLD/schedule text.
      ev.preventDefault();
      panState.current = {
        startX: ev.clientX,
        startY: ev.clientY,
        pan0: { ...panRef.current },
        moved: false,
      };
    }
  }

  // --- click-to-select diagram elements (native delegation on base SVG) ---
  //
  // The base SVG is rendered via dangerouslySetInnerHTML, so its inner
  // elements aren't managed by React. We attach a *native* click listener
  // directly to the wrapper so the event reliably fires no matter how the
  // overlay above it routes events. We walk up from event.target to find a
  // [data-element-id] ancestor, which `renderDiagramArea` tags on every
  // selectable pipe and component.
  const baseSvgWrapperRef = useRef<HTMLDivElement>(null);
  // Refs let the listener see the latest mode/state without re-binding the
  // event each render.
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const elementSelectableRef = useRef(elementSelectable);
  elementSelectableRef.current = elementSelectable;

  useEffect(() => {
    const root = baseSvgWrapperRef.current;
    if (!root) return;
    function onClick(ev: MouseEvent) {
      if (toolRef.current !== "select" || !elementSelectableRef.current) return;
      // Swallow the click that ends a pan-drag so it doesn't change selection.
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      const target = ev.target as Element | null;
      if (!target) return;
      const el = target.closest("[data-element-id]") as SVGElement | null;
      if (el) {
        ev.stopPropagation();
        setSelectedElement({
          id: el.getAttribute("data-element-id")!,
          kind:
            (el.getAttribute("data-element-kind") as "node" | "edge") ??
            "node",
        });
        setSelectedAnnId(null);
      } else {
        setSelectedElement(null);
        setSelectedAnnId(null);
      }
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  // Reflect `selectedElement` onto the rendered base-SVG by toggling
  // `data-selected="true"` on the matching <g>. CSS embedded in the wrapped
  // SVG handles the visual highlight, so we never rebuild the SVG string
  // when selection changes — keeps interaction snappy on large diagrams.
  useEffect(() => {
    const root = baseSvgWrapperRef.current;
    if (!root) return;
    root.querySelectorAll("[data-selected]").forEach((n) => {
      (n as SVGElement).removeAttribute("data-selected");
    });
    if (selectedElement) {
      const el = root.querySelector(
        `[data-element-id="${cssEscape(selectedElement.id)}"]`,
      );
      if (el) (el as SVGElement).setAttribute("data-selected", "true");
    }
  }, [selectedElement, baseSvg]);

  // --- annotation drag-to-reposition ---
  const dragState = useRef<{
    annId: string;
    offsetX: number;
    offsetY: number;
    arrowDelta?: { dx: number; dy: number };
  } | null>(null);

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!dragState.current || !svgRef.current) return;
      const { annId, offsetX, offsetY, arrowDelta } = dragState.current;
      const p = pageCoordsFrom(ev, svgRef.current);
      const newX = p.x - offsetX;
      const newY = p.y - offsetY;
      if (arrowDelta) {
        // For arrows the user grabs one endpoint and we translate both points.
        updateAnnotation(page.id, annId, {
          x: newX,
          y: newY,
          x2: newX + arrowDelta.dx,
          y2: newY + arrowDelta.dy,
        });
      } else {
        updateAnnotation(page.id, annId, { x: newX, y: newY });
      }
    }
    function onUp() {
      dragState.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [page.id, updateAnnotation]);

  /**
   * Zoom button helper: keeps the viewport-center point fixed while zooming,
   * or fully resets to a centred fit when `recenter` is true.
   */
  function zoomAtViewportCenter(newZoom: number, recenter: boolean) {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (recenter) {
      setZoom(1);
      setPan({
        x: (rect.width - pageSize.w) / 2,
        y: (rect.height - pageSize.h) / 2,
      });
      return;
    }
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const real = newZoom / zoom;
    setZoom(newZoom);
    setPan({
      x: mx - (mx - pan.x) * real,
      y: my - (my - pan.y) * real,
    });
  }

  // --- keyboard shortcuts ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inField =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (inField) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnId) {
        e.preventDefault();
        removeAnnotation(page.id, selectedAnnId);
        setSelectedAnnId(null);
      } else if (e.key === "Escape") {
        setTool("select");
        setArrowDraft(null);
        setSelectedAnnId(null);
        setSelectedElement(null);
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        zoomAtViewportCenter(1, true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, selectedAnnId, removeAnnotation, pageSize.w, pageSize.h]);

  async function onCaptureClick(e: React.MouseEvent<SVGRectElement>) {
    if (!svgRef.current) return;
    // Ignore the click that terminates a pan-drag.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const p = pageCoordsFrom(e, svgRef.current);

    if (tool === "text") {
      const text = await askText({
        title: "Add text annotation",
        initialValue: "",
        multiline: false,
        confirmLabel: "Add",
      });
      if (text) {
        addAnnotation(page.id, {
          id: newAnnotationId(),
          kind: "text",
          x: p.x,
          y: p.y,
          text,
          fontSize: 4,
        });
      }
      setTool("select");
    } else if (tool === "note") {
      const text = await askText({
        title: "Add note",
        hint: "Ctrl+Enter to confirm · Esc to cancel · Enter inserts a new line",
        initialValue: "",
        multiline: true,
        confirmLabel: "Add",
      });
      if (text) {
        addAnnotation(page.id, {
          id: newAnnotationId(),
          kind: "note",
          x: p.x,
          y: p.y,
          text,
          fontSize: 3.2,
        });
      }
      setTool("select");
    } else if (tool === "arrow") {
      // Two-click arrow: first click sets the tail, second sets the head.
      // We deliberately don't prompt for a label any more — arrow labels
      // caused too many positioning and click-routing conflicts and are
      // better placed as a separate text annotation right next to the arrow.
      if (!arrowDraft) {
        setArrowDraft(p);
      } else {
        addAnnotation(page.id, {
          id: newAnnotationId(),
          kind: "arrow",
          x: arrowDraft.x,
          y: arrowDraft.y,
          x2: p.x,
          y2: p.y,
        });
        setArrowDraft(null);
        setTool("select");
      }
    } else {
      setSelectedAnnId(null);
    }
  }

  function startDragAnnotation(e: React.MouseEvent, ann: Annotation) {
    if (tool !== "select") return; // only drag in select mode
    e.stopPropagation();
    if (!svgRef.current) return;
    setSelectedAnnId(ann.id);
    const p = pageCoordsFrom(e, svgRef.current);
    if (ann.kind === "arrow") {
      dragState.current = {
        annId: ann.id,
        offsetX: p.x - ann.x,
        offsetY: p.y - ann.y,
        arrowDelta: {
          dx: (ann.x2 ?? ann.x) - ann.x,
          dy: (ann.y2 ?? ann.y) - ann.y,
        },
      };
    } else {
      dragState.current = {
        annId: ann.id,
        offsetX: p.x - ann.x,
        offsetY: p.y - ann.y,
      };
    }
  }

  const currentOverride =
    selectedElement && page.colorOverrides
      ? page.colorOverrides[selectedElement.id]
      : undefined;
  const currentWidth =
    selectedElement && page.widthOverrides
      ? page.widthOverrides[selectedElement.id]
      : undefined;
  const selectedLabel = useMemo(() => {
    if (!selectedElement) return "";
    // SLD pages carry a frozen electrical snapshot with a different data
    // shape (connectionType, symbolType) so they get their own describer.
    if (page.type === "sld" && page.sld) {
      return describeSldElement(
        selectedElement,
        page.sld.nodes,
        page.sld.edges,
      );
    }
    // Diagram pages render the *frozen* snapshot, so we resolve labels from
    // it; if that's missing (e.g. element was removed from the live diagram
    // after capture) we fall back to live state and finally to a generic
    // label so a stale selection still reads sensibly.
    const nodes = page.diagram?.nodes ?? liveNodes;
    const edges = page.diagram?.edges ?? liveEdges;
    return describeElement(selectedElement, nodes, edges);
  }, [selectedElement, page.type, page.sld, page.diagram, liveNodes, liveEdges]);

  const placementActive = tool !== "select";

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <Toolbar
        tool={tool}
        setTool={setTool}
        arrowDraft={arrowDraft}
        setArrowDraft={setArrowDraft}
        selectedAnnId={selectedAnnId}
        pageId={page.id}
        zoom={zoom}
        onZoomReset={() => zoomAtViewportCenter(1, true)}
        onZoomIn={() =>
          zoomAtViewportCenter(Math.min(MAX_ZOOM, zoom * 1.2), false)
        }
        onZoomOut={() =>
          zoomAtViewportCenter(Math.max(MIN_ZOOM, zoom / 1.2), false)
        }
        onClearSelection={() => setSelectedAnnId(null)}
      />

      {/* Floating style bar appears whenever a diagram element is selected.
          Kept above the page so it never gets clipped by zooming/panning. */}
      {selectedElement && elementSelectable && (
        <StylePanel
          label={selectedLabel}
          kind={selectedElement.kind}
          currentColor={currentOverride}
          currentWidth={currentWidth}
          onPickColor={(c) =>
            setColorOverride(page.id, selectedElement.id, c)
          }
          onResetColor={() =>
            setColorOverride(page.id, selectedElement.id, null)
          }
          onPickWidth={(m) =>
            setWidthOverride(page.id, selectedElement.id, m)
          }
          onResetWidth={() =>
            setWidthOverride(page.id, selectedElement.id, null)
          }
          onDeselect={() => setSelectedElement(null)}
          colorOverrideCount={Object.keys(page.colorOverrides ?? {}).length}
          widthOverrideCount={Object.keys(page.widthOverrides ?? {}).length}
          onClearAll={() => {
            clearAllColorOverrides(page.id);
            clearAllWidthOverrides(page.id);
          }}
        />
      )}

      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden bg-zinc-950"
        onMouseDown={onMouseDownViewport}
        style={{
          cursor: placementActive
            ? PLACEMENT_CURSOR
            : panning
              ? PAN_CURSOR
              : ARROW_CURSOR,
          // The drawing sheet is never a text document — disabling selection
          // keeps click-drag panning from highlighting all the SLD / schedule
          // text underneath the cursor.
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* Page wrapper. We resize it in actual CSS pixels (width/height) for
            zoom rather than CSS-scaling, so the SVG inside re-rasterises at
            the displayed resolution and stays sharp no matter how far you zoom.
            Pan stays as a `translate` so it's a cheap GPU transform. */}
        <div
          className="absolute bg-white shadow-2xl"
          style={{
            top: 0,
            left: 0,
            width: pageSize.w * zoom,
            height: pageSize.h * zoom,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            willChange: "transform",
            ...(placementActive && {
              colorScheme: "light",
              cursor: PLACEMENT_CURSOR,
            }),
          }}
        >
          {/*
            In select mode on a diagram page the base SVG receives clicks so
            our native delegated handler can find the [data-element-id]
            target. In every other mode (text/note/arrow annotations) the
            overlay captures clicks instead.
          */}
          <div
            ref={baseSvgWrapperRef}
            className="absolute inset-0"
            style={{
              pointerEvents:
                tool === "select" && elementSelectable && !panning
                  ? "auto"
                  : "none",
            }}
            dangerouslySetInnerHTML={{ __html: baseSvg }}
          />
          <svg
            ref={svgRef}
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
            preserveAspectRatio="xMidYMid meet"
            // In select-mode on a diagram page the overlay must be fully
            // transparent to pointer events so element clicks reach the
            // base SVG underneath. Annotations re-enable pointer events on
            // themselves via `pointerEvents: "auto"` (see AnnotationLayer)
            // so they stay clickable. In every other mode the overlay is
            // active and the capture rect collects clicks for annotation
            // placement.
            style={{
              pointerEvents:
                tool === "select" && elementSelectable ? "none" : "auto",
              ...(placementActive && { cursor: PLACEMENT_CURSOR }),
            }}
          >
            {/* Always-present transparent capture rect — guarantees the SVG
                gets clicks anywhere on the page, not just over painted
                children. In select mode on a diagram page we let it pass
                through to the base SVG so element-clicks can register. */}
            <rect
              x={0}
              y={0}
              width={PAGE_W}
              height={PAGE_H}
              fill="transparent"
              onClick={onCaptureClick}
              style={{
                pointerEvents:
                  tool === "select" && elementSelectable ? "none" : "all",
                ...(placementActive && { cursor: PLACEMENT_CURSOR }),
              }}
            />

            {arrowDraft && (
              <>
                <circle
                  cx={arrowDraft.x}
                  cy={arrowDraft.y}
                  r={1.6}
                  fill="#0ea5e9"
                />
                <text
                  x={arrowDraft.x + 2}
                  y={arrowDraft.y - 1.5}
                  fontSize={2.4}
                  fill="#0ea5e9"
                  fontFamily="Inter, Helvetica, Arial, sans-serif"
                >
                  click again for the arrow tip
                </text>
              </>
            )}

            {/* Annotations + handles. Drawing them as a styled overlay (rather
                than relying on the static base SVG below) means we get live,
                selectable, draggable interaction in a single render pass.
                Note: legacy arrow annotations may carry a `text` field — it
                is intentionally not rendered any more. */}
            {page.annotations.map((ann) => {
              const isSelected = ann.id === selectedAnnId;
              return (
                <AnnotationLayer
                  key={ann.id}
                  ann={ann}
                  selected={isSelected}
                  dragCursorStyle={
                    placementActive ? PLACEMENT_CURSOR : "move"
                  }
                  onSelect={() => setSelectedAnnId(ann.id)}
                  onStartDrag={(e) => startDragAnnotation(e, ann)}
                  onDoubleClick={async () => {
                    // Arrows carry no editable text — see arrow-creation
                    // comment above. Double-clicking an arrow is a no-op.
                    if (ann.kind === "arrow") return;
                    const next = await askText({
                      title: "Edit annotation",
                      initialValue: ann.text ?? "",
                      multiline: ann.kind === "note",
                      confirmLabel: "Save",
                    });
                    if (next !== null) {
                      updateAnnotation(page.id, ann.id, { text: next });
                    }
                  }}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {promptState && (
        <TextPromptModal
          title={promptState.title}
          hint={promptState.hint}
          initialValue={promptState.initialValue}
          multiline={promptState.multiline}
          confirmLabel={promptState.confirmLabel}
          onSubmit={(value) => {
            promptState.resolve(value);
            setPromptState(null);
          }}
          onCancel={() => {
            promptState.resolve(null);
            setPromptState(null);
          }}
        />
      )}
    </div>
  );
}

function Toolbar({
  tool,
  setTool,
  arrowDraft,
  setArrowDraft,
  selectedAnnId,
  pageId,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClearSelection,
}: {
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
  arrowDraft: { x: number; y: number } | null;
  setArrowDraft: (a: { x: number; y: number } | null) => void;
  selectedAnnId: string | null;
  pageId: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClearSelection: () => void;
}) {
  const removeAnnotation = useDrawingsStore((s) => s.removeAnnotation);
  return (
    <div className="flex items-center gap-1 border-b border-zinc-800 bg-[var(--color-panel)] px-3 py-1.5">
      <ToolBtn label="Select" active={tool === "select"} onClick={() => setTool("select")} />
      <ToolBtn label="Text" active={tool === "text"} onClick={() => setTool("text")} />
      <ToolBtn label="Note" active={tool === "note"} onClick={() => setTool("note")} />
      <ToolBtn
        label={arrowDraft ? "→ End-point" : "Arrow"}
        active={tool === "arrow"}
        onClick={() => {
          setTool("arrow");
          setArrowDraft(null);
        }}
      />
      {selectedAnnId && (
        <button
          type="button"
          onClick={() => {
            removeAnnotation(pageId, selectedAnnId);
            onClearSelection();
          }}
          className="ml-2 flex items-center gap-1 rounded border border-red-800 bg-red-950/40 px-2 py-0.5 text-[10px] text-red-200 hover:border-red-500"
        >
          <Trash2 size={11} /> Delete annotation
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded border border-zinc-800 bg-[var(--color-panel-2)]">
          <ZoomBtn icon={MinusCircle} title="Zoom out" onClick={onZoomOut} />
          <button
            type="button"
            onClick={onZoomReset}
            title="Reset view (Ctrl+0)"
            className="px-1 text-[10px] tabular-nums text-zinc-300 hover:text-zinc-100"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ZoomBtn icon={PlusCircle} title="Zoom in" onClick={onZoomIn} />
          <ZoomBtn icon={Maximize2} title="Fit to view (Ctrl+0)" onClick={onZoomReset} />
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Sparkles size={11} className="text-amber-400" />
          Scroll to zoom · drag to pan · click pipe / component to recolour
        </div>
      </div>
    </div>
  );
}

function AnnotationLayer({
  ann,
  selected,
  dragCursorStyle,
  onSelect,
  onStartDrag,
  onDoubleClick,
}: {
  ann: Annotation;
  selected: boolean;
  /** `move` in select mode; black crosshair while placing annotations */
  dragCursorStyle: string;
  onSelect: () => void;
  onStartDrag: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  const box = annotationBox(ann);

  const onMouseDown = (e: React.MouseEvent) => {
    onSelect();
    onStartDrag(e);
  };

  if (ann.kind === "text") {
    return (
      <g style={{ cursor: dragCursorStyle, pointerEvents: "auto" }}>
        <text
          x={ann.x}
          y={ann.y}
          fontSize={ann.fontSize ?? 4}
          fontFamily="Inter, Helvetica, Arial, sans-serif"
          fill="#0f172a"
          dominantBaseline="hanging"
          onMouseDown={onMouseDown}
          onDoubleClick={onDoubleClick}
          style={{ userSelect: "none" }}
        >
          {ann.text ?? ""}
        </text>
        <rect
          x={box.x - 1}
          y={box.y - 1}
          width={box.w + 2}
          height={box.h + 2}
          fill="transparent"
          stroke={selected ? "#0ea5e9" : "transparent"}
          strokeDasharray="1 0.7"
          strokeWidth={0.25}
          onMouseDown={onMouseDown}
          onDoubleClick={onDoubleClick}
        />
      </g>
    );
  }

  if (ann.kind === "note") {
    const fontSize = ann.fontSize ?? 3.2;
    const { lines, padding, lineHeight } = computeNoteBox(
      ann.text ?? "",
      fontSize,
    );
    return (
      <g
        style={{ cursor: dragCursorStyle, pointerEvents: "auto" }}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
      >
        <rect
          x={ann.x}
          y={ann.y}
          width={box.w}
          height={box.h}
          fill="#fffbeb"
          stroke={selected ? "#0ea5e9" : "#f59e0b"}
          strokeWidth={selected ? 0.5 : 0.3}
          rx={1}
        />
        {lines.map((l, i) => (
          <text
            key={i}
            x={ann.x + padding}
            y={ann.y + padding + i * lineHeight}
            fontSize={fontSize}
            fontFamily="Inter, Helvetica, Arial, sans-serif"
            fill="#0f172a"
            dominantBaseline="hanging"
            style={{ userSelect: "none" }}
          >
            {l}
          </text>
        ))}
      </g>
    );
  }

  // arrow
  const x2 = ann.x2 ?? ann.x;
  const y2 = ann.y2 ?? ann.y;
  return (
    <g
      style={{ cursor: dragCursorStyle, pointerEvents: "auto" }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <defs>
        <marker
          id={`overlay-arr-${ann.id}`}
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="3"
          markerHeight="3"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#0f172a" />
        </marker>
      </defs>
      <line
        x1={ann.x}
        y1={ann.y}
        x2={x2}
        y2={y2}
        stroke="#0f172a"
        strokeWidth={selected ? 0.7 : 0.5}
        markerEnd={`url(#overlay-arr-${ann.id})`}
      />
      {/* Arrow text was removed — arrows now render line + arrowhead only. */}
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill="transparent"
        stroke={selected ? "#0ea5e9" : "transparent"}
        strokeDasharray="1 0.7"
        strokeWidth={0.25}
      />
    </g>
  );
}

function ToolBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-0.5 text-[11px] transition",
        active
          ? "border-sky-500 bg-sky-500/15 text-sky-200"
          : "border-zinc-700 bg-[var(--color-panel-2)] text-zinc-300 hover:border-zinc-500",
      )}
    >
      {label}
    </button>
  );
}

function ZoomBtn({
  icon: Icon,
  title,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="px-1 py-0.5 text-zinc-400 hover:text-zinc-100"
    >
      <Icon size={13} />
    </button>
  );
}

/* ----------------------- element-selection helpers ----------------------- */

/** Quote any character that has special meaning in a CSS attribute selector
 *  so we can safely use arbitrary node/edge ids inside `querySelector`. */
function cssEscape(s: string): string {
  if (typeof (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS
    ?.escape === "function") {
    return (globalThis as { CSS: { escape: (s: string) => string } }).CSS.escape(s);
  }
  return s.replace(/["\\]/g, "\\$&");
}

function describeElement(
  sel: SelectedElement,
  nodes: ReturnType<typeof useDiagramStore.getState>["nodes"],
  edges: ReturnType<typeof useDiagramStore.getState>["edges"],
): string {
  if (sel.kind === "node") {
    const n = nodes.find((x) => x.id === sel.id);
    if (!n) return "Component";
    const tag = n.data.tag || n.data.label || sel.id;
    return `Component · ${tag}`;
  }
  const e = edges.find((x) => x.id === sel.id);
  if (!e) return "Pipe";
  const src = nodes.find((x) => x.id === e.source);
  const dst = nodes.find((x) => x.id === e.target);
  const srcLabel = src?.data.tag || src?.data.label || e.source;
  const dstLabel = dst?.data.tag || dst?.data.label || e.target;
  const lineType = e.data?.lineType ?? "process";
  return `${prettyLineType(lineType)} · ${srcLabel} → ${dstLabel}`;
}

/** Label resolver for frozen electrical SLD snapshots (ElecNode / ElecEdge). */
function describeSldElement(
  sel: SelectedElement,
  nodes: SldView["nodes"],
  edges: SldView["edges"],
): string {
  if (sel.kind === "node") {
    const n = nodes.find((x) => x.id === sel.id);
    if (!n) return "Component";
    const tag = n.data.tag || n.data.label || sel.id;
    return `Component · ${tag}`;
  }
  const e = edges.find((x) => x.id === sel.id);
  if (!e) return "Feeder";
  const src = nodes.find((x) => x.id === e.source);
  const dst = nodes.find((x) => x.id === e.target);
  const srcLabel = src?.data.tag || src?.data.label || e.source;
  const dstLabel = dst?.data.tag || dst?.data.label || e.target;
  return `${prettyConnType(e.data?.connectionType ?? "lv-power")} · ${srcLabel} → ${dstLabel}`;
}

function prettyConnType(t: string): string {
  switch (t) {
    case "lv-power":
      return "LV feeder";
    case "mv-power":
      return "MV feeder";
    case "control":
      return "Control wiring";
    case "earth":
      return "Earth / bonding";
    case "data":
      return "Data / comms";
    case "direct":
      return "Bolted connection";
    default:
      return "Feeder";
  }
}

function prettyLineType(t: string): string {
  switch (t) {
    case "process":
      return "Process pipe";
    case "utility":
      return "Utility pipe";
    case "pneumatic":
      return "Pneumatic signal";
    case "electric":
      return "Electric signal";
    default:
      return "Pipe";
  }
}

const WIDTH_PRESETS: { label: string; value: number }[] = [
  { label: "Thin", value: 0.6 },
  { label: "Normal", value: 1.0 },
  { label: "Bold", value: 1.5 },
  { label: "Heavy", value: 2.0 },
  { label: "Extra", value: 2.6 },
];

function StylePanel({
  label,
  kind,
  currentColor,
  currentWidth,
  onPickColor,
  onResetColor,
  onPickWidth,
  onResetWidth,
  onDeselect,
  colorOverrideCount,
  widthOverrideCount,
  onClearAll,
}: {
  label: string;
  kind: "node" | "edge";
  currentColor: string | undefined;
  currentWidth: number | undefined;
  onPickColor: (color: string) => void;
  onResetColor: () => void;
  onPickWidth: (multiplier: number) => void;
  onResetWidth: () => void;
  onDeselect: () => void;
  colorOverrideCount: number;
  widthOverrideCount: number;
  onClearAll: () => void;
}) {
  const totalOverrides = colorOverrideCount + widthOverrideCount;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-800 bg-[var(--color-panel-2)] px-3 py-1.5 text-[11px] text-zinc-200">
      <Palette size={13} className="text-sky-300" />
      <span className="font-medium text-zinc-100">{label}</span>

      <div className="flex items-center gap-1">
        <span className="text-zinc-400">Colour:</span>
        {COLOR_PALETTE.map((c) => (
          <button
            type="button"
            key={c.value}
            title={c.label}
            onClick={() => onPickColor(c.value)}
            className={cn(
              "h-4 w-4 rounded-sm border transition",
              currentColor?.toLowerCase() === c.value.toLowerCase()
                ? "border-sky-300 ring-1 ring-sky-400"
                : "border-zinc-700 hover:border-zinc-400",
            )}
            style={{ backgroundColor: c.value }}
          />
        ))}
        <label
          className="ml-1 flex h-4 items-center gap-1 rounded-sm border border-zinc-700 px-1 hover:border-zinc-500"
          title="Custom colour"
        >
          <span className="text-[10px] text-zinc-400">Custom</span>
          <input
            type="color"
            value={currentColor ?? "#000000"}
            onChange={(e) => onPickColor(e.target.value)}
            className="h-3 w-4 cursor-pointer border-0 bg-transparent p-0"
            style={{ appearance: "auto" }}
          />
        </label>
        <button
          type="button"
          onClick={onResetColor}
          className="ml-0.5 flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500"
          title="Reset to default colour"
        >
          <RotateCcw size={10} />
        </button>
      </div>

      {/* Line-thickness picker only makes sense for pipes — components have a
          single outline that doesn't change with width. */}
      {kind === "edge" && (
        <div className="flex items-center gap-1">
          <span className="text-zinc-400">Width:</span>
          {WIDTH_PRESETS.map((w) => {
            const active = (currentWidth ?? 1) === w.value;
            return (
              <button
                type="button"
                key={w.value}
                title={`${w.label} (${w.value.toFixed(2)}×)`}
                onClick={() => onPickWidth(w.value)}
                className={cn(
                  "flex h-4 items-center rounded-sm border px-1.5 text-[10px] transition",
                  active
                    ? "border-sky-300 bg-sky-500/15 text-sky-200"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-400",
                )}
              >
                {w.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onResetWidth}
            className="ml-0.5 flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500"
            title="Reset to default thickness"
          >
            <RotateCcw size={10} />
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {totalOverrides > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500"
            title="Clear all colour & width overrides on this page"
          >
            <Trash2 size={10} /> Clear all ({totalOverrides})
          </button>
        )}
        <button
          type="button"
          onClick={onDeselect}
          className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500"
          title="Deselect (Esc)"
        >
          <X size={10} /> Deselect
        </button>
      </div>
    </div>
  );
}
