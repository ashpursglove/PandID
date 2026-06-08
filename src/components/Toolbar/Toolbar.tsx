import { useEffect } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  FileText,
  FolderOpen,
  Save,
  FilePlus2,
  FileDown,
  FileInput,
  Sheet,
  Undo2,
  Redo2,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { useDiagramStore, useDiagramHistory } from "@/store/diagramStore";
import {
  useElectricalStore,
  useElectricalHistory,
} from "@/electrical/store/electricalStore";
import { useUIStore, type AppTab } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import { useProjectIO } from "@/io/useProjectIO";
import { HoverTooltipWrap } from "@/components/shared/HoverTooltip";
import { cn } from "@/lib/utils";

import { RecentMenu } from "./RecentMenu";

const TABS: { id: AppTab; label: string }[] = [
  { id: "editor", label: "P&ID Editor" },
  { id: "analysis", label: "P&ID Analysis" },
  { id: "electrical", label: "Electrical Editor" },
  { id: "drawings", label: "Drawings" },
];

export function Toolbar() {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  const meta = useProjectStore((s) => s.meta);
  const filePath = useProjectStore((s) => s.filePath);
  const isDirty = useProjectStore((s) => s.isDirty);
  // Edit actions are discipline-aware: when the Electrical tab is active they
  // target the SLD store, otherwise the P&ID diagram store. We read both sets
  // unconditionally (hooks rules) and pick based on the tab.
  const isElectrical = tab === "electrical";

  const pidActions = useDiagramStore(
    useShallow((s) => ({
      removeSelected: s.removeSelected,
      rotateSelected: s.rotateSelected,
      copySelection: s.copySelection,
      cutSelection: s.cutSelection,
      pasteClipboard: s.pasteClipboard,
    })),
  );
  const elecActions = useElectricalStore(
    useShallow((s) => ({
      removeSelected: s.removeSelected,
      rotateSelected: s.rotateSelected,
      copySelection: s.copySelection,
      cutSelection: s.cutSelection,
      pasteClipboard: s.pasteClipboard,
    })),
  );
  const { removeSelected, rotateSelected, copySelection, cutSelection, pasteClipboard } =
    isElectrical ? elecActions : pidActions;

  // The label next to the app name should reflect what's actually on disk so
  // saving / loading is visibly reflected. The bare meta.title is a poor
  // proxy because save/load doesn't touch it. Prefer the saved file's
  // basename (without the .pid extension); fall back to the project title.
  const projectLabel = projectDisplayName(filePath, meta.title);

  const pidTemporal = useStore(useDiagramHistory());
  const elecTemporal = useStore(useElectricalHistory());
  const temporal = isElectrical ? elecTemporal : pidTemporal;
  const canUndo = temporal.pastStates.length > 0;
  const canRedo = temporal.futureStates.length > 0;

  const {
    newProject,
    openProject,
    importProject,
    save,
    saveAs,
    openRecent,
    exportPdf,
    exportCsv,
  } = useProjectIO();

  // Global keyboard shortcuts. We deliberately *don't* fire clipboard or
  // undo/redo shortcuts when focus is in a text field — the user is editing
  // a tag or parameter and the browser's native text-field clipboard /
  // undo must win there.
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
      } else if ((e.key === "c" || e.key === "C") && !inField) {
        e.preventDefault();
        copySelection();
      } else if ((e.key === "x" || e.key === "X") && !inField) {
        e.preventDefault();
        cutSelection();
      } else if ((e.key === "v" || e.key === "V") && !inField) {
        e.preventDefault();
        pasteClipboard();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    newProject,
    openProject,
    save,
    saveAs,
    temporal,
    copySelection,
    cutSelection,
    pasteClipboard,
  ]);

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
          Ash&rsquo;s MEP Playground
        </span>
        <span className="text-xs text-zinc-500" title={filePath ?? meta.title}>
          {projectLabel}
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
        <ToolbarButton
          icon={FileText}
          label="New project"
          shortcut="Ctrl+N"
          description="Start a blank project. Clears the P&ID, electrical SLD, and drawings unless you save first."
          onClick={newProject}
        />
        <ToolbarButton
          icon={FolderOpen}
          label="Open project"
          shortcut="Ctrl+O"
          description="Open a saved .pid project file. Replaces everything in the current document."
          onClick={openProject}
        />
        <ToolbarButton
          icon={Save}
          label="Save"
          shortcut="Ctrl+S"
          description="Save changes to the current project file on disk."
          onClick={save}
        />
        <ToolbarButton
          icon={FilePlus2}
          label="Save As"
          shortcut="Ctrl+Shift+S"
          description="Save the project under a new file name or folder."
          onClick={saveAs}
        />
        <ToolbarButton
          icon={FileInput}
          label="Import"
          description="Merge another project's P&ID and SLD into this one. Imported parts are placed above existing content so you can drag them into place."
          onClick={importProject}
        />
        <RecentMenu onOpen={openRecent} />
        <ToolbarButton
          icon={FileDown}
          label="Export PDF"
          description="Export the drawing package as PDF. Uses Drawings tab pages when you have set them up; otherwise exports the P&ID."
          onClick={exportPdf}
        />
        <ToolbarButton
          icon={Sheet}
          label="Export equipment CSV"
          description="Export the P&ID equipment list as a spreadsheet-friendly CSV file."
          onClick={exportCsv}
        />
        <Divider />
        <ToolbarButton
          icon={Undo2}
          label="Undo"
          shortcut="Ctrl+Z"
          description="Undo the last change on the active editor (P&ID or electrical, depending on which tab is open)."
          disabled={!canUndo}
          onClick={() => temporal.undo()}
        />
        <ToolbarButton
          icon={Redo2}
          label="Redo"
          shortcut="Ctrl+Y"
          description="Redo the last undone change on the active editor."
          disabled={!canRedo}
          onClick={() => temporal.redo()}
        />
        <Divider />
        <ToolbarButton
          icon={Trash2}
          label="Delete"
          shortcut="Del"
          description="Remove the selected components, pipes, or cables from the diagram."
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
  label: string;
  shortcut?: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
}

function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  description,
  onClick,
  disabled,
}: ToolbarButtonProps) {
  return (
    <HoverTooltipWrap
      title={label}
      subtitle={shortcut}
      description={description}
      placement="below"
    >
      {(handlers) => (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          {...handlers}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition",
            "hover:bg-zinc-800 hover:text-zinc-100",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
          )}
        >
          <Icon size={16} strokeWidth={1.75} />
        </button>
      )}
    </HoverTooltipWrap>
  );
}

/**
 * Pick the most sensible label for the project shown in the top bar:
 *
 *   - Saved file → its basename without the `.pid` extension.
 *     Handles Windows (`\\`) and POSIX (`/`) separators; falls back to the
 *     raw path if neither shows up (browser-fallback "untitled.pid").
 *   - No file yet → the meta title (default "Untitled Project").
 */
function projectDisplayName(
  filePath: string | null,
  metaTitle: string,
): string {
  if (filePath) {
    const base = filePath.split(/[\\/]/).pop() ?? filePath;
    return base.replace(/\.pid$/i, "");
  }
  return metaTitle;
}
