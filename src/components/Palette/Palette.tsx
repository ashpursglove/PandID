import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { useUIStore } from "@/store/uiStore";
import { useDiagramStore } from "@/store/diagramStore";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  groupedSubcategories,
} from "@/symbols/registry";
import { LINE_STYLES, LINE_TYPE_ORDER } from "@/symbols/lines/lineStyles";
import type { LineType } from "@/types/diagram";
import type { SymbolCategory, SymbolDef } from "@/symbols/types";
import { DRAG_DATA_TYPE } from "@/components/Palette/dragMime";
import { cn } from "@/lib/utils";

interface PaletteProps {
  className?: string;
}

/** Categories that start expanded the first time the palette mounts. */
const INITIAL_OPEN: SymbolCategory[] = ["equipment", "valve"];

export function Palette({ className }: PaletteProps) {
  const [openCategories, setOpenCategories] = useState<Set<SymbolCategory>>(
    () => new Set(INITIAL_OPEN),
  );
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const tree = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        groups: groupedSubcategories(category),
      })),
    [],
  );

  const lowerQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!lowerQuery) return tree;
    return tree
      .map(({ category, groups }) => ({
        category,
        groups: groups
          .map((g) => ({
            name: g.name,
            symbols: g.symbols.filter(
              (s) =>
                s.label.toLowerCase().includes(lowerQuery) ||
                s.type.toLowerCase().includes(lowerQuery) ||
                (s.description?.toLowerCase().includes(lowerQuery) ?? false) ||
                (s.subcategory?.toLowerCase().includes(lowerQuery) ?? false),
            ),
          }))
          .filter((g) => g.symbols.length > 0),
      }))
      .filter((c) => c.groups.length > 0);
  }, [tree, lowerQuery]);

  function toggleCategory(category: SymbolCategory) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function toggleSub(key: string) {
    setOpenSubs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-zinc-800 bg-[var(--color-panel)]",
        className,
      )}
    >
      <header className="flex flex-col gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Palette
        </span>
        <label className="relative flex items-center">
          <Search
            size={12}
            className="pointer-events-none absolute left-2 text-zinc-500"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="w-full rounded border border-zinc-800 bg-zinc-950 py-1 pl-7 pr-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-500"
          />
        </label>
      </header>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] text-zinc-500">
            No components match “{query}”.
          </p>
        )}
        {filtered.map(({ category, groups }) => {
          const isOpen = lowerQuery !== "" || openCategories.has(category);
          return (
            <div key={category} className="mb-1">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800/60"
              >
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>{CATEGORY_LABELS[category]}</span>
                <span className="ml-auto text-[10px] font-normal text-zinc-600">
                  {groups.reduce((n, g) => n + g.symbols.length, 0)}
                </span>
              </button>
              {isOpen && (
                <div className="mt-1 flex flex-col gap-0.5 pl-3">
                  {groups.map((group) => {
                    const subKey = `${category}::${group.name}`;
                    const subOpen =
                      lowerQuery !== "" ||
                      openSubs.has(subKey) ||
                      groups.length === 1;
                    return (
                      <Subgroup
                        key={subKey}
                        name={group.name}
                        open={subOpen}
                        count={group.symbols.length}
                        onToggle={() => toggleSub(subKey)}
                        symbols={group.symbols}
                        hideHeader={groups.length === 1 && group.name === "Connectors"}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <LineStyleSection />
      </div>
      <footer className="border-t border-zinc-800 px-3 py-2 text-[10px] leading-snug text-zinc-500">
        Drag a symbol to the canvas. Drop instruments near a pipe to auto-tap.
      </footer>
    </aside>
  );
}

interface SubgroupProps {
  name: string;
  open: boolean;
  count: number;
  onToggle: () => void;
  symbols: SymbolDef[];
  hideHeader?: boolean;
}

function Subgroup({
  name,
  open,
  count,
  onToggle,
  symbols,
  hideHeader,
}: SubgroupProps) {
  return (
    <div className="mb-1">
      {!hideHeader && (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium uppercase tracking-wide text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
        >
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span>{name}</span>
          <span className="ml-auto text-[9px] font-normal text-zinc-600">
            {count}
          </span>
        </button>
      )}
      {open && (
        <div className="mt-1 grid grid-cols-2 gap-1 px-0.5">
          {symbols.map((symbol) => (
            <PaletteItem key={symbol.type} symbol={symbol} />
          ))}
        </div>
      )}
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
      <span className="flex h-9 w-full items-center justify-center text-zinc-200">
        <Icon width={36} height={36} />
      </span>
      <span className="line-clamp-2 text-center text-[9.5px] leading-tight text-zinc-400 group-hover:text-zinc-200">
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
    if (selectedEdgeId) updateEdgeData(selectedEdgeId, { lineType });
  }

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
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
