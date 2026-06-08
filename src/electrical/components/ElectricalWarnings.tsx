import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";

import type { ElecIssue } from "@/electrical/analysis/validate";
import { useElectricalStore } from "@/electrical/store/electricalStore";
import { cn } from "@/lib/utils";

export function ElectricalWarnings({ issues }: { issues: ElecIssue[] }) {
  const [open, setOpen] = useState(false);
  const focusElement = useElectricalStore((s) => s.focusElement);
  const nodes = useElectricalStore((s) => s.nodes);
  const { setCenter, getZoom } = useReactFlow();

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;

  const focus = (issue: ElecIssue) => {
    focusElement(issue.nodeIds[0] ?? null, issue.edgeIds[0] ?? null);
    const nodeId = issue.nodeIds[0];
    if (nodeId) {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        const w = (node.width ?? node.measured?.width ?? 48) as number;
        const h = (node.height ?? node.measured?.height ?? 48) as number;
        setCenter(node.position.x + w / 2, node.position.y + h / 2, {
          zoom: getZoom(),
          duration: 400,
        });
      }
    }
  };

  if (issues.length === 0) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/80 px-3 py-1 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur">
          <CheckCircle2 size={13} strokeWidth={2} />
          No electrical issues
        </div>
      </div>
    );
  }

  return (
    <div className="absolute left-1/2 top-3 z-10 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-t-lg border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur transition",
          errors > 0
            ? "border-red-800/70 bg-red-950/85 text-red-200"
            : "border-amber-800/70 bg-amber-950/85 text-amber-200",
          !open && "rounded-b-lg",
        )}
      >
        <AlertTriangle size={14} strokeWidth={2} />
        <span>
          {errors > 0 && `${errors} error${errors > 1 ? "s" : ""}`}
          {errors > 0 && warnings > 0 && ", "}
          {warnings > 0 && `${warnings} warning${warnings > 1 ? "s" : ""}`}
        </span>
        <ChevronDown
          size={14}
          className={cn("ml-auto transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="max-h-72 overflow-y-auto rounded-b-lg border border-t-0 border-zinc-700 bg-zinc-900/95 shadow-lg backdrop-blur">
          {issues.map((issue) => {
            const clickable =
              issue.nodeIds.length > 0 || issue.edgeIds.length > 0;
            return (
              <li
                key={issue.id}
                className="border-b border-zinc-800 last:border-b-0"
              >
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && focus(issue)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left text-xs",
                    clickable
                      ? "hover:bg-zinc-800/70"
                      : "cursor-default opacity-90",
                  )}
                >
                  <AlertTriangle
                    size={13}
                    strokeWidth={2}
                    className={cn(
                      "mt-0.5 shrink-0",
                      issue.severity === "error"
                        ? "text-red-400"
                        : "text-amber-400",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-zinc-100">
                      {issue.title}
                    </span>
                    <span className="block text-zinc-400">{issue.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
