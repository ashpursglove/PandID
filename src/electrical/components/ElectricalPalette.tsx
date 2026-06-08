import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import {
  ELEC_CATEGORY_LABELS,
  ELEC_CATEGORY_ORDER,
  elecGroupedSubcategories,
  getElecHelp,
} from "@/electrical/symbols/registry";
import {
  CONNECTION_STYLES,
  CONNECTION_TYPE_ORDER,
} from "@/electrical/symbols/connectionStyles";
import { useElectricalStore } from "@/electrical/store/electricalStore";
import type { ConnectionType, ElecCategory, ElecSymbolDef } from "@/electrical/types";
import { ELEC_DRAG_DATA_TYPE } from "./dragMime";
import { cn } from "@/lib/utils";

interface PaletteProps {
  className?: string;
}

const INITIAL_OPEN: ElecCategory[] = ["source", "protection", "load"];

export function ElectricalPalette({ className }: PaletteProps) {
  const [openCategories, setOpenCategories] = useState<Set<ElecCategory>>(
    () => new Set(INITIAL_OPEN),
  );
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const tree = useMemo(
    () =>
      ELEC_CATEGORY_ORDER.map((category) => ({
        category,
        groups: elecGroupedSubcategories(category),
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

  function toggleCategory(category: ElecCategory) {
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
          SLD palette
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
                <span>{ELEC_CATEGORY_LABELS[category]}</span>
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
                        hideHeader={groups.length === 1}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <ConnectionStyleSection />
      </div>
      <footer className="border-t border-zinc-800 px-3 py-2 text-[10px] leading-snug text-zinc-500">
        Drag a component onto the canvas. Drag between port handles to wire.
      </footer>
    </aside>
  );
}

interface SubgroupProps {
  name: string;
  open: boolean;
  count: number;
  onToggle: () => void;
  symbols: ElecSymbolDef[];
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

function PaletteItem({ symbol }: { symbol: ElecSymbolDef }) {
  const { Icon } = symbol;
  const [tip, setTip] = useState<{ x: number; y: number; left: boolean } | null>(
    null,
  );
  const hideTimer = useRef<number | null>(null);

  const showTip = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const tipWidth = 256;
    // Prefer the right of the palette; flip left if it would run off-screen.
    const placeLeft = rect.right + tipWidth + 16 > window.innerWidth;
    setTip({
      x: placeLeft ? rect.left - 8 : rect.right + 8,
      y: rect.top,
      left: placeLeft,
    });
  };

  const hideTip = () => {
    hideTimer.current = window.setTimeout(() => setTip(null), 40);
  };

  return (
    <>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(ELEC_DRAG_DATA_TYPE, symbol.type);
          e.dataTransfer.effectAllowed = "move";
          setTip(null);
        }}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        className="group flex flex-col items-center gap-1 rounded border border-zinc-800 bg-[var(--color-panel-2)] p-1.5 transition hover:border-zinc-600 hover:bg-zinc-800"
      >
        <span className="flex h-9 w-full items-center justify-center text-zinc-200">
          <Icon width={36} height={36} />
        </span>
        <span className="line-clamp-2 text-center text-[9.5px] leading-tight text-zinc-400 group-hover:text-zinc-200">
          {symbol.label}
        </span>
      </button>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 w-64 rounded-md border border-zinc-700 bg-zinc-900/95 p-2.5 text-left shadow-xl backdrop-blur"
          style={{
            top: tip.y,
            left: tip.left ? undefined : tip.x,
            right: tip.left ? window.innerWidth - tip.x : undefined,
          }}
        >
          <p className="text-xs font-semibold text-zinc-100">{symbol.label}</p>
          {symbol.description && symbol.description !== symbol.label && (
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-400/90">
              {symbol.description}
            </p>
          )}
          <p className="mt-1 text-[11px] leading-snug text-zinc-300">
            {getElecHelp(symbol)}
          </p>
        </div>
      )}
    </>
  );
}

function ConnectionStyleSection() {
  const active = useElectricalStore((s) => s.nextConnectionType);
  const setNext = useElectricalStore((s) => s.setNextConnectionType);
  const selectedEdgeId = useElectricalStore((s) => s.selectedEdgeId);
  const updateEdgeData = useElectricalStore((s) => s.updateEdgeData);

  function choose(connectionType: ConnectionType) {
    setNext(connectionType);
    if (selectedEdgeId) updateEdgeData(selectedEdgeId, { connectionType });
  }

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      <h3 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Connection types
      </h3>
      <div className="flex flex-col gap-1">
        {CONNECTION_TYPE_ORDER.map((connectionType) => {
          const style = CONNECTION_STYLES[connectionType];
          const isActive = active === connectionType;
          return (
            <button
              key={connectionType}
              type="button"
              onClick={() => choose(connectionType)}
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
              </svg>
              <span className="flex-1 text-zinc-200">{style.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
