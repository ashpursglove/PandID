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
} from "@/store/drawingsStore";
import { renderDrawingPage } from "@/io/drawingsRender";
import { PAGE_H, PAGE_W } from "@/io/svgRender";
import { cn } from "@/lib/utils";

/* ----- element selection (pipes / components in diagram pages) --------- */

interface SelectedElement {
  id: string;
  kind: "node" | "edge";
}

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
    const lines = (ann.text ?? "").split("\n");
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
    const padding = 1.5;
    const charW = fontSize * 0.55;
    const w = Math.max(20, longest * charW + 2 * padding);
    const h = lines.length * (fontSize + 0.6) + 2 * padding;
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

  // Only diagram pages render selectable nodes/edges — analysis pages have
  // their own (read-only) styling, BOM pages are pure text, etc.
  const elementSelectable = page.type === "diagram";

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

  // --- middle-button / space-drag panning ---
  const panState = useRef<{ startX: number; startY: number; pan0: { x: number; y: number } } | null>(
    null,
  );
  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!panState.current) return;
      const dx = ev.clientX - panState.current.startX;
      const dy = ev.clientY - panState.current.startY;
      setPan({
        x: panState.current.pan0.x + dx,
        y: panState.current.pan0.y + dy,
      });
    }
    function onUp() {
      panState.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function onMouseDownViewport(ev: React.MouseEvent) {
    // Middle button starts a pan.
    if (ev.button === 1) {
      ev.preventDefault();
      panState.current = {
        startX: ev.clientX,
        startY: ev.clientY,
        pan0: { ...pan },
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

  function onCaptureClick(e: React.MouseEvent<SVGRectElement>) {
    if (!svgRef.current) return;
    const p = pageCoordsFrom(e, svgRef.current);

    if (tool === "text") {
      const text = prompt("Annotation text:");
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
      const text = prompt("Note text (use Enter for new lines):");
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
      if (!arrowDraft) {
        setArrowDraft(p);
      } else {
        const text = prompt("Label (optional):") ?? "";
        addAnnotation(page.id, {
          id: newAnnotationId(),
          kind: "arrow",
          x: arrowDraft.x,
          y: arrowDraft.y,
          x2: p.x,
          y2: p.y,
          text: text || undefined,
          fontSize: 3.2,
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
    // Diagram pages render the *frozen* snapshot, so we resolve labels from
    // it; if that's missing (e.g. element was removed from the live diagram
    // after capture) we fall back to live state and finally to a generic
    // label so a stale selection still reads sensibly.
    const nodes = page.diagram?.nodes ?? liveNodes;
    const edges = page.diagram?.edges ?? liveEdges;
    return describeElement(selectedElement, nodes, edges);
  }, [selectedElement, page.diagram, liveNodes, liveEdges]);

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
        style={{ cursor: panState.current ? "grabbing" : undefined }}
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
                tool === "select" && elementSelectable ? "auto" : "none",
            }}
            dangerouslySetInnerHTML={{ __html: baseSvg }}
          />
          <svg
            ref={svgRef}
            className={cn(
              "absolute inset-0 h-full w-full",
              tool !== "select" && "cursor-crosshair",
            )}
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
                  fontFamily="Helvetica, Arial, sans-serif"
                >
                  click again for the arrow tip
                </text>
              </>
            )}

            {/* Annotations + handles. Drawing them as a styled overlay (rather
                than relying on the static base SVG below) means we get live,
                selectable, draggable interaction in a single render pass. */}
            {page.annotations.map((ann) => {
              const isSelected = ann.id === selectedAnnId;
              return (
                <AnnotationLayer
                  key={ann.id}
                  ann={ann}
                  selected={isSelected}
                  onSelect={() => setSelectedAnnId(ann.id)}
                  onStartDrag={(e) => startDragAnnotation(e, ann)}
                  onDoubleClick={() => {
                    const next = prompt("Edit text:", ann.text ?? "");
                    if (next !== null)
                      updateAnnotation(page.id, ann.id, { text: next });
                  }}
                />
              );
            })}
          </svg>
        </div>
      </div>
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
          Scroll to zoom · middle-drag to pan · click pipe / component to recolour
        </div>
      </div>
    </div>
  );
}

function AnnotationLayer({
  ann,
  selected,
  onSelect,
  onStartDrag,
  onDoubleClick,
}: {
  ann: Annotation;
  selected: boolean;
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
      <g style={{ cursor: "move", pointerEvents: "auto" }}>
        <text
          x={ann.x}
          y={ann.y}
          fontSize={ann.fontSize ?? 4}
          fontFamily="Helvetica, Arial, sans-serif"
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
    const lines = (ann.text ?? "").split("\n");
    const padding = 1.5;
    return (
      <g
        style={{ cursor: "move", pointerEvents: "auto" }}
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
            y={ann.y + padding + i * (fontSize + 0.6)}
            fontSize={fontSize}
            fontFamily="Helvetica, Arial, sans-serif"
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
      style={{ cursor: "move", pointerEvents: "auto" }}
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
      {ann.text && (
        <text
          x={(ann.x + x2) / 2}
          y={(ann.y + y2) / 2 - 1.2}
          fontSize={ann.fontSize ?? 3}
          fontFamily="Helvetica, Arial, sans-serif"
          fill="#0f172a"
          textAnchor="middle"
          style={{ userSelect: "none" }}
        >
          {ann.text}
        </text>
      )}
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
