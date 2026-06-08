import { useState } from "react";
import { Cable, ClipboardList, ListTree, Workflow } from "lucide-react";

import { ElectricalEditor } from "./ElectricalEditor";
import {
  CableScheduleReport,
  ElectricalBomReport,
  LoadScheduleReport,
} from "./ElectricalReports";
import { cn } from "@/lib/utils";

type ElecView = "sld" | "loads" | "cables" | "bom";

const VIEWS: { id: ElecView; label: string; icon: typeof Workflow }[] = [
  { id: "sld", label: "Single-line", icon: Workflow },
  { id: "loads", label: "Schedule of loads", icon: ListTree },
  { id: "cables", label: "Cable schedule", icon: Cable },
  { id: "bom", label: "Bill of materials", icon: ClipboardList },
];

export function ElectricalWorkspace() {
  const [view, setView] = useState<ElecView>("sld");

  return (
    <div className="flex h-full w-full flex-col">
      <nav className="flex shrink-0 items-center gap-1 border-b border-zinc-800 bg-[var(--color-panel)] px-3 py-1.5">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
                active
                  ? "bg-zinc-700 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              <Icon size={13} strokeWidth={1.75} />
              {v.label}
            </button>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1">
        {/* The SLD editor stays mounted so its React Flow state + capture
            button persist; reports are cheap to remount on demand. */}
        <div className={cn("h-full", view === "sld" ? "block" : "hidden")}>
          <ElectricalEditor />
        </div>
        {view === "loads" && <LoadScheduleReport />}
        {view === "cables" && <CableScheduleReport />}
        {view === "bom" && <ElectricalBomReport />}
      </div>
    </div>
  );
}
