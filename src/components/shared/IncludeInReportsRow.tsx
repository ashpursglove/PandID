import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

/** Checkbox for including / excluding an element from BOMs and schedules. */
export function IncludeInReportsRow({
  checked,
  onChange,
  label = "Include in BOM",
  className,
}: Props) {
  return (
    <label className={cn("flex items-center gap-2", className)}>
      <input
        type="checkbox"
        className="accent-sky-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
    </label>
  );
}
