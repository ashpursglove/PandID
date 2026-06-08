import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { loadRecent, type RecentFile } from "@/io/recentFiles";
import { HoverTooltipWrap } from "@/components/shared/HoverTooltip";
import { cn } from "@/lib/utils";

interface RecentMenuProps {
  onOpen: (path: string) => void;
}

export function RecentMenu({ onOpen }: RecentMenuProps) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setRecent(loadRecent());
  }, [open]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <HoverTooltipWrap
        title="Recent files"
        description="Open a project from your recently used .pid files. The list updates whenever you save or open a project."
        placement="below"
      >
        {(handlers) => (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            {...handlers}
            className={cn(
              "flex h-8 items-center gap-1 rounded px-2 text-xs text-zinc-400 transition",
              "hover:bg-zinc-800 hover:text-zinc-100",
            )}
          >
            Recent <ChevronDown size={12} />
          </button>
        )}
      </HoverTooltipWrap>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-72 rounded-md border border-zinc-800 bg-[var(--color-panel)] py-1 shadow-xl">
          {recent.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-500">
              No recent projects.
            </p>
          )}
          {recent.map((r) => (
            <button
              key={r.path}
              type="button"
              onClick={() => {
                setOpen(false);
                onOpen(r.path);
              }}
              className="block w-full truncate px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
              title={r.path}
            >
              <span className="block truncate">{r.name}</span>
              <span className="block truncate text-[10px] text-zinc-500">
                {r.path}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
