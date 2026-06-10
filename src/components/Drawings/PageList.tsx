import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Copy,
  FileText,
  Heading,
  ListChecks,
  Plus,
  Sigma,
  Trash2,
  Sticker,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  newPageId,
  useDrawingsStore,
  type DrawingPage,
} from "@/store/drawingsStore";
import { useDiagramStore } from "@/store/diagramStore";
import { diagramBounds } from "@/io/geometry";
import { cn } from "@/lib/utils";

export function PageList() {
  const pages = useDrawingsStore((s) => s.pages);
  const selectedId = useDrawingsStore((s) => s.selectedPageId);
  const selectPage = useDrawingsStore((s) => s.selectPage);
  const movePage = useDrawingsStore((s) => s.movePage);
  const removePage = useDrawingsStore((s) => s.removePage);
  const duplicatePage = useDrawingsStore((s) => s.duplicatePage);
  const addPage = useDrawingsStore((s) => s.addPage);
  const [addOpen, setAddOpen] = useState(false);

  function addBlank() {
    addPage({
      id: newPageId(),
      title: `Page ${pages.length + 1}`,
      type: "blank",
      titleBlock: {},
      annotations: [],
    });
    setAddOpen(false);
  }

  function addTitlePage() {
    addPage({
      id: newPageId(),
      title: "Title page",
      type: "title",
      titleBlock: {},
      annotations: [],
      titlePage: {
        heading: "Project Title",
        subheading: "",
      },
    });
    setAddOpen(false);
  }

  function addFullDiagram() {
    const nodes = useDiagramStore.getState().nodes;
    const edges = useDiagramStore.getState().edges;
    if (nodes.length === 0) {
      alert("There's nothing to capture — the diagram is empty.");
      return;
    }
    const bounds = diagramBounds(nodes);
    // Add a small margin around the captured world bounds so symbols near the
    // edge aren't clipped.
    const padX = (bounds.maxX - bounds.minX) * 0.05 + 20;
    const padY = (bounds.maxY - bounds.minY) * 0.05 + 20;
    addPage({
      id: newPageId(),
      title: `Full diagram — sheet ${pages.length + 1}`,
      type: "diagram",
      titleBlock: {},
      diagram: {
        bounds: {
          minX: bounds.minX - padX,
          minY: bounds.minY - padY,
          maxX: bounds.maxX + padX,
          maxY: bounds.maxY + padY,
        },
        nodes: structuredClone(nodes),
        edges: structuredClone(edges),
      },
      annotations: [],
    });
    setAddOpen(false);
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-[var(--color-panel)]">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Pages ({pages.length})
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="flex items-center gap-1 rounded border border-zinc-700 bg-[var(--color-panel-2)] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500 hover:text-sky-300"
          >
            <Plus size={11} /> Add
          </button>
          {addOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 flex w-44 flex-col rounded-md border border-zinc-700 bg-[var(--color-panel-2)] shadow-lg">
              <AddOption icon={Heading} label="Title / section page" onClick={addTitlePage} />
              <AddOption icon={FileText} label="Full diagram" onClick={addFullDiagram} />
              <AddOption icon={Sticker} label="Blank annotation page" onClick={addBlank} />
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-1.5">
        {pages.length === 0 ? (
          <EmptyHint />
        ) : (
          pages.map((p, idx) => (
            <PageRow
              key={p.id}
              page={p}
              index={idx}
              total={pages.length}
              selected={p.id === selectedId}
              onSelect={() => selectPage(p.id)}
              onMoveUp={() => movePage(p.id, -1)}
              onMoveDown={() => movePage(p.id, 1)}
              onRemove={() => removePage(p.id)}
              onDuplicate={() => duplicatePage(p.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function AddOption({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function EmptyHint() {
  return (
    <div className="rounded border border-dashed border-zinc-800 p-3 text-[11px] leading-relaxed text-zinc-500">
      <p className="mb-1 text-zinc-400">No pages yet.</p>
      <p>
        Switch to the <span className="text-zinc-300">Editor</span> and use
        <span className="mx-1 rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">
          Send view to Drawings
        </span>
        , run an analysis and use the
        <span className="mx-1 rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">
          Send report
        </span>
        button, or click
        <span className="mx-1 rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">
          + Add
        </span>
        above for a BOM or blank page.
      </p>
    </div>
  );
}

function PageRow({
  page,
  index,
  total,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDuplicate,
}: {
  page: DrawingPage;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const TypeIcon =
    page.type === "diagram"
      ? FileText
      : page.type === "sld"
        ? Zap
        : page.type === "analysis"
          ? Sigma
          : page.type === "bom"
            ? ClipboardList
            : page.type === "elec-schedule"
              ? ListChecks
              : page.type === "title"
                ? Heading
                : Sticker;
  return (
    <div
      className={cn(
        "group mb-1 cursor-pointer rounded border px-2 py-2 transition",
        selected
          ? "border-sky-500 bg-sky-500/10"
          : "border-zinc-800 bg-[var(--color-panel-2)] hover:border-zinc-600",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-300">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-zinc-100">
            {page.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
            <TypeIcon size={9} /> {page.type}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
        <RowBtn
          icon={ArrowUp}
          title="Move up"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={index === 0}
        />
        <RowBtn
          icon={ArrowDown}
          title="Move down"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={index === total - 1}
        />
        <RowBtn
          icon={Copy}
          title="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        />
        <RowBtn
          icon={Trash2}
          title="Delete page"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${page.title}"?`)) onRemove();
          }}
        />
      </div>
    </div>
  );
}

function RowBtn({
  icon: Icon,
  title,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-30"
    >
      <Icon size={11} />
    </button>
  );
}
