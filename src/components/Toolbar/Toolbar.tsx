import { useEffect } from "react";
import { useStore } from "zustand";
import {
  FileText,
  FolderOpen,
  Save,
  FilePlus2,
  FileDown,
  Sheet,
  Undo2,
  Redo2,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { useDiagramStore, useDiagramHistory } from "@/store/diagramStore";
import { useUIStore, type AppTab } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import { useProjectIO } from "@/io/useProjectIO";
import { cn } from "@/lib/utils";

import { RecentMenu } from "./RecentMenu";

const TABS: { id: AppTab; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "analysis", label: "Analysis" },
  { id: "drawings", label: "Drawings" },
];

export function Toolbar() {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  const meta = useProjectStore((s) => s.meta);
  const isDirty = useProjectStore((s) => s.isDirty);
  const removeSelected = useDiagramStore((s) => s.removeSelected);
  const rotateSelected = useDiagramStore((s) => s.rotateSelected);

  const temporal = useStore(useDiagramHistory());
  const canUndo = temporal.pastStates.length > 0;
  const canRedo = temporal.futureStates.length > 0;

  const {
    newProject,
    openProject,
    save,
    saveAs,
    openRecent,
    exportPdf,
    exportCsv,
  } = useProjectIO();

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.ctrlKey || e.metaKey;
      const inField =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (!cmd) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (e.shiftKey) saveAs();
        else save();
      } else if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        openProject();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        newProject();
      } else if ((e.key === "z" || e.key === "Z") && !inField) {
        e.preventDefault();
        if (e.shiftKey) temporal.redo();
        else temporal.undo();
      } else if ((e.key === "y" || e.key === "Y") && !inField) {
        e.preventDefault();
        temporal.redo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [newProject, openProject, save, saveAs, temporal]);

  // Rotation shortcuts work without modifier keys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inField =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        rotateSelected(e.shiftKey ? -90 : 90);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rotateSelected]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-[var(--color-panel)] px-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          PandID
        </span>
        <span className="text-xs text-zinc-500">
          {meta.title}
          {isDirty ? " *" : ""}
        </span>
      </div>

      <nav className="flex gap-1 rounded-md border border-zinc-800 bg-[var(--color-panel-2)] p-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition",
              tab === t.id
                ? "bg-zinc-700 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-1">
        <ToolbarButton icon={FileText} title="New project (Ctrl+N)" onClick={newProject} />
        <ToolbarButton
          icon={FolderOpen}
          title="Open project (Ctrl+O)"
          onClick={openProject}
        />
        <ToolbarButton icon={Save} title="Save (Ctrl+S)" onClick={save} />
        <ToolbarButton
          icon={FilePlus2}
          title="Save As… (Ctrl+Shift+S)"
          onClick={saveAs}
        />
        <RecentMenu onOpen={openRecent} />
        <ToolbarButton icon={FileDown} title="Export PDF" onClick={exportPdf} />
        <ToolbarButton
          icon={Sheet}
          title="Export equipment list CSV"
          onClick={exportCsv}
        />
        <Divider />
        <ToolbarButton
          icon={Undo2}
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => temporal.undo()}
        />
        <ToolbarButton
          icon={Redo2}
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={() => temporal.redo()}
        />
        <Divider />
        <ToolbarButton
          icon={Trash2}
          title="Delete selected (Del)"
          onClick={removeSelected}
        />
      </div>
    </header>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden />;
}

interface ToolbarButtonProps {
  icon: LucideIcon;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}

function ToolbarButton({ icon: Icon, title, onClick, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition",
        "hover:bg-zinc-800 hover:text-zinc-100",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
      )}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}
