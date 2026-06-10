import { useCallback, useState } from "react";
import { ClipboardList } from "lucide-react";

import { sendPidBomToDrawings } from "@/components/Drawings/sendBomPage";

interface Props {
  className?: string;
}

/**
 * Builds a Bill-of-Materials page from the live P&ID and drops it into the
 * Drawings tab. Sits alongside "Send view to Drawings" so the BOM can be pulled
 * straight from the editor without hunting through the Drawings "Add" menu.
 */
export function SendBomButton({ className }: Props) {
  const [confirming, setConfirming] = useState(false);

  const onClick = useCallback(() => {
    if (!sendPidBomToDrawings()) return;
    setConfirming(true);
    window.setTimeout(() => setConfirming(false), 1400);
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      title="Build a Bill of Materials from this P&ID and add it to the Drawings tab"
      className={`absolute right-3 top-12 z-10 flex items-center gap-1.5 rounded-md border border-zinc-700 bg-[var(--color-panel)]/95 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 shadow-lg backdrop-blur transition hover:border-sky-500 hover:text-sky-200 ${className ?? ""}`}
    >
      <ClipboardList size={13} strokeWidth={1.75} />
      {confirming ? "Sent ✓" : "Send BOM to Drawings"}
    </button>
  );
}
