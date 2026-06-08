import { useState } from "react";
import { Wand2 } from "lucide-react";

import { useElectricalStore } from "@/electrical/store/electricalStore";

interface Props {
  className?: string;
}

/**
 * One-click cable optimisation: resizes every power feeder (down or up) to the
 * smallest standard CSA that carries its downstream load with no overload error
 * and no near-capacity warning, and drops three-phase feeders to single-phase
 * wherever nothing downstream needs three phases. Reports a short summary.
 */
export function AutoSizeButton({ className }: Props) {
  const autoSize = useElectricalStore((s) => s.autoSizeCables);
  const [msg, setMsg] = useState<string | null>(null);

  function onClick() {
    const r = autoSize();
    let text: string;
    if (r.considered === 0) {
      text = "No power feeders to size";
    } else if (r.resized === 0 && r.phaseReduced === 0 && r.devicesResized === 0) {
      text = "Already optimal ✓";
    } else {
      const parts: string[] = [];
      if (r.resized > 0) {
        parts.push(`${r.resized} cable${r.resized === 1 ? "" : "s"} resized`);
      }
      if (r.devicesResized > 0) {
        parts.push(`${r.devicesResized} device${r.devicesResized === 1 ? "" : "s"} rated`);
      }
      if (r.phaseReduced > 0) {
        parts.push(`${r.phaseReduced} → single-phase`);
      }
      text = parts.join(" · ");
      if (r.undersizedRemaining > 0) {
        text += ` · ${r.undersizedRemaining} need parallel runs`;
      }
    }
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2800);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Auto Size: resize every cable to the smallest size that carries its load with no overload error and no near-capacity warning, pick the smallest standard frame for each breaker/MCCB/ACB on its path, and drop three-phase feeders to single-phase where nothing downstream needs three phases."
      className={`absolute right-3 top-12 z-10 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-700 bg-[var(--color-panel)]/95 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 shadow-lg backdrop-blur transition hover:border-sky-500 hover:text-sky-200 ${className ?? ""}`}
    >
      <Wand2 size={13} strokeWidth={1.75} />
      {msg ?? "Auto size cables"}
    </button>
  );
}
