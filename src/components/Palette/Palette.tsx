import { useUIStore } from "@/store/uiStore";
import { useDiagramStore } from "@/store/diagramStore";
import {
  CATEGORY_LABELS,
  SYMBOL_ORDER,
  SYMBOL_REGISTRY,
} from "@/symbols/registry";
import { LINE_STYLES, LINE_TYPE_ORDER } from "@/symbols/lines/lineStyles";
import type { LineType } from "@/types/diagram";
import type { SymbolCategory, SymbolDef } from "@/symbols/types";
import { DRAG_DATA_TYPE } from "@/components/Palette/dragMime";
import { cn } from "@/lib/utils";

interface PaletteProps {
  className?: string;
}

const CATEGORY_ORDER: SymbolCategory[] = [
  "equipment",
  "valve",
  "instrument",
  "connector",
];

export function Palette({ className }: PaletteProps) {
  return (
    <aside
      className={cn(
        "flex flex-col border-r border-zinc-800 bg-[var(--color-panel)]",
        className,
      )}
    >
      <header className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Palette
      </header>
      <div className="flex-1 overflow-y-auto p-2">
        {CATEGORY_ORDER.map((category) => (
          <CategorySection
            key={category}
            category={category}
            symbols={SYMBOL_ORDER[category]
              .map((id) => SYMBOL_REGISTRY[id])
              .filter(Boolean)}
          />
        ))}
        <LineStyleSection />
      </div>
      <footer className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-500">
        Drag onto the canvas. Lines: click to set the active style for new
        connections.
      </footer>
    </aside>
  );
}

interface CategorySectionProps {
  category: SymbolCategory;
  symbols: SymbolDef[];
}

function CategorySection({ category, symbols }: CategorySectionProps) {
  if (symbols.length === 0) return null;
  return (
    <div className="mb-3">
      <h3 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {CATEGORY_LABELS[category]}
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {symbols.map((symbol) => (
          <PaletteItem key={symbol.type} symbol={symbol} />
        ))}
      </div>
    </div>
  );
}

function PaletteItem({ symbol }: { symbol: SymbolDef }) {
  const { Icon } = symbol;
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_DATA_TYPE, symbol.type);
        e.dataTransfer.effectAllowed = "move";
      }}
      title={symbol.label}
      className="group flex flex-col items-center gap-1 rounded border border-zinc-800 bg-[var(--color-panel-2)] p-1.5 transition hover:border-zinc-600 hover:bg-zinc-800"
    >
      <span className="flex h-10 w-full items-center justify-center text-zinc-200">
        <Icon width={40} height={40} />
      </span>
      <span className="line-clamp-2 text-center text-[10px] leading-tight text-zinc-400 group-hover:text-zinc-200">
        {symbol.label}
      </span>
    </button>
  );
}

function LineStyleSection() {
  const active = useUIStore((s) => s.activeLineType);
  const setActive = useUIStore((s) => s.setActiveLineType);
  const setNextLineType = useDiagramStore((s) => s.setNextLineType);
  const selectedEdgeId = useDiagramStore((s) => s.selectedEdgeId);
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);

  function choose(lineType: LineType) {
    setActive(lineType);
    setNextLineType(lineType);
    // If an edge is selected, retag it immediately for fast iteration.
    if (selectedEdgeId) updateEdgeData(selectedEdgeId, { lineType });
  }

  return (
    <div className="mb-3">
      <h3 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Line types
      </h3>
      <div className="flex flex-col gap-1">
        {LINE_TYPE_ORDER.map((lineType) => {
          const style = LINE_STYLES[lineType];
          const isActive = active === lineType;
          return (
            <button
              key={lineType}
              type="button"
              onClick={() => choose(lineType)}
              className={cn(
                "flex items-center gap-2 rounded border px-2 py-1.5 text-left text-xs transition",
                isActive
                  ? "border-sky-500 bg-zinc-800"
                  : "border-zinc-800 bg-[var(--color-panel-2)] hover:border-zinc-600",
              )}
            >
              <svg width={36} height={10} viewBox="0 0 36 10">
                <line
                  x1={0}
                  y1={5}
                  x2={36}
                  y2={5}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.strokeDasharray}
                />
                {style.pattern === "hash" && (
                  <line
                    x1={0}
                    y1={5}
                    x2={36}
                    y2={5}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth + 4}
                    strokeDasharray="1 8"
                  />
                )}
              </svg>
              <span className="flex-1 text-zinc-200">{style.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
