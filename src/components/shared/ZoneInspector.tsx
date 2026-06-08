import { ZONE_COLORS } from "./zone";

const FIELD_CLASS =
  "w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-sky-500";
const LABEL_CLASS = "text-[11px] font-medium text-zinc-400";

interface Props {
  label: string;
  color: string;
  onLabel: (label: string) => void;
  onColor: (color: string) => void;
}

/**
 * Shared editor for an area/zone node — a label and a colour swatch picker.
 * Used by both the P&ID and electrical inspectors.
 */
export function ZoneInspector({ label, color, onLabel, onColor }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Area / zone</h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          A labelled box that groups part of the drawing. Drag it by its tab,
          resize from the edges.
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>Label</span>
        <input
          className={FIELD_CLASS}
          value={label}
          onChange={(e) => onLabel(e.target.value)}
          placeholder="e.g. Pump room"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>Colour</span>
        <div className="flex flex-wrap gap-1.5">
          {ZONE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColor(c)}
              title={c}
              className="h-6 w-6 rounded border transition"
              style={{
                background: c,
                borderColor: c === color ? "#fff" : "transparent",
                boxShadow: c === color ? `0 0 0 2px ${c}` : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
