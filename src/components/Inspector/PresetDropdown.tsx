import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface PresetItem<T> {
  id: string;
  label: string;
  values: T;
}

interface PresetDropdownProps<T> {
  items: PresetItem<T>[];
  selectedId: string | undefined;
  onSelect: (item: PresetItem<T>) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Custom preset picker — avoids native &lt;select&gt; option styling (invisible
 * text in WebView2 / dark theme) and shows the currently selected preset label.
 */
export function PresetDropdown<T>({
  items,
  selectedId,
  onSelect,
  onClear,
  placeholder = "Choose preset…",
  className,
  disabled,
}: PresetDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = items.find((i) => i.id === selectedId);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={cn(
            "flex min-h-8 flex-1 items-center justify-between gap-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-left text-xs outline-none hover:border-zinc-600",
            selected ? "text-zinc-100" : "text-zinc-500",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 text-zinc-400 transition",
              open && "rotate-180",
            )}
          />
        </button>
        {selectedId && onClear && !disabled && (
          <button
            type="button"
            title="Clear preset"
            onClick={() => onClear()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {open && !disabled && (
        <ul className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-56 overflow-auto rounded border border-zinc-600 bg-zinc-950 py-1 shadow-xl">
          {items.length === 0 ? (
            <li className="px-2 py-2 text-center text-[11px] text-zinc-500">
              No presets in this group.
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-2 py-1.5 text-left text-xs text-zinc-100 hover:bg-zinc-800",
                    item.id === selectedId && "bg-zinc-800/90",
                  )}
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
